const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

// environment.js exits the process if these are missing; values are never used to connect.
Object.assign(process.env, {
  PORT: '0',
  MONGO_URI: 'mongodb://unused',
  JWT_SECRET: 'test',
  CLIENT_URL: 'http://localhost',
  NODE_ENV: 'test',
});

const Team = require('../../src/models/Team');
const User = require('../../src/models/User');
const { chooseNextCandidate, pickAssigneeForLevel } = require('../../src/services/escalationService');

const TEAM_ID = 'team1';

function user(id, role) {
  return { _id: { toString: () => id }, role };
}

describe('chooseNextCandidate', () => {
  const a = user('a', 'TEAM_LEAD');
  const b = user('b', 'TEAM_LEAD');

  test('starts at the first candidate when there is no cursor', () => {
    assert.strictEqual(chooseNextCandidate([a, b], undefined), a);
  });

  test('advances to the candidate after the cursor', () => {
    assert.strictEqual(chooseNextCandidate([a, b], 'a'), b);
  });

  test('wraps around after the last candidate', () => {
    assert.strictEqual(chooseNextCandidate([a, b], 'b'), a);
  });

  test('restarts at the first candidate when the cursor user is gone', () => {
    assert.strictEqual(chooseNextCandidate([a, b], 'someone-deleted'), a);
  });
});

describe('pickAssigneeForLevel', () => {
  let usersByRole;
  let rotation;
  let updates;

  beforeEach(() => {
    usersByRole = { EMPLOYEE: [], TEAM_LEAD: [], MANAGER: [] };
    rotation = {};
    updates = [];

    mock.method(Team, 'findById', async () => ({ _id: TEAM_ID, rotation }));
    mock.method(Team, 'updateOne', async (filter, update) => {
      updates.push(update.$set);
    });
    mock.method(User, 'find', (query) => ({ sort: async () => usersByRole[query.role] }));
  });

  afterEach(() => mock.restoreAll());

  test('round-robins through the users at a level and records the cursor', async () => {
    const sarah = user('sarah', 'TEAM_LEAD');
    const priya = user('priya', 'TEAM_LEAD');
    usersByRole.TEAM_LEAD = [sarah, priya];

    const first = await pickAssigneeForLevel(TEAM_ID, 'TEAM_LEAD');
    assert.strictEqual(first.user, sarah);
    assert.deepStrictEqual(updates[0], { 'rotation.TEAM_LEAD': sarah._id });

    rotation.TEAM_LEAD = sarah._id;
    const second = await pickAssigneeForLevel(TEAM_ID, 'TEAM_LEAD');
    assert.strictEqual(second.user, priya);

    rotation.TEAM_LEAD = priya._id;
    const third = await pickAssigneeForLevel(TEAM_ID, 'TEAM_LEAD');
    assert.strictEqual(third.user, sarah);
  });

  test('skips a level nobody holds and reports the level actually reached', async () => {
    const mike = user('mike', 'MANAGER');
    usersByRole.MANAGER = [mike];

    const picked = await pickAssigneeForLevel(TEAM_ID, 'TEAM_LEAD');
    assert.strictEqual(picked.user, mike);
    assert.strictEqual(picked.level, 'MANAGER');
  });

  test('never hands the incident back to the excluded current assignee', async () => {
    const sarah = user('sarah', 'TEAM_LEAD');
    const mike = user('mike', 'MANAGER');
    usersByRole.TEAM_LEAD = [sarah];
    usersByRole.MANAGER = [mike];

    const picked = await pickAssigneeForLevel(TEAM_ID, 'TEAM_LEAD', sarah._id);
    assert.strictEqual(picked.user, mike);
    assert.strictEqual(picked.level, 'MANAGER');
  });

  test('returns null when nobody at or above the level exists', async () => {
    usersByRole.EMPLOYEE = [user('john', 'EMPLOYEE')];

    assert.strictEqual(await pickAssigneeForLevel(TEAM_ID, 'TEAM_LEAD'), null);
    assert.strictEqual(updates.length, 0);
  });

  test('never escalates sideways: an employee level pick ignores leads and managers', async () => {
    const john = user('john', 'EMPLOYEE');
    usersByRole.EMPLOYEE = [john];
    usersByRole.TEAM_LEAD = [user('sarah', 'TEAM_LEAD')];

    const picked = await pickAssigneeForLevel(TEAM_ID, 'EMPLOYEE');
    assert.strictEqual(picked.user, john);
    assert.strictEqual(picked.level, 'EMPLOYEE');
  });
});
