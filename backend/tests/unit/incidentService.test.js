const { test, describe } = require('node:test');
const assert = require('node:assert');

// environment.js exits the process if these are missing; values are never used to connect.
Object.assign(process.env, {
  PORT: '0',
  MONGO_URI: 'mongodb://unused',
  JWT_SECRET: 'test',
  CLIENT_URL: 'http://localhost',
  NODE_ENV: 'test',
});

const { assertCanAct } = require('../../src/services/incidentService');

function id(value) {
  return { toString: () => value };
}

function incident({ assignedTo, escalationLevel }) {
  return { assignedTo: assignedTo ? id(assignedTo) : null, escalationLevel };
}

function actor(userId, role) {
  return { _id: id(userId), role };
}

describe('assertCanAct', () => {
  test('allows the current assignee', () => {
    assert.doesNotThrow(() =>
      assertCanAct(incident({ assignedTo: 'a', escalationLevel: 'EMPLOYEE' }), actor('a', 'EMPLOYEE'))
    );
  });

  test('blocks a peer employee from acting on a colleague\'s incident', () => {
    assert.throws(
      () => assertCanAct(incident({ assignedTo: 'a', escalationLevel: 'EMPLOYEE' }), actor('b', 'EMPLOYEE')),
      { code: 'NOT_AUTHORIZED' }
    );
  });

  test('lets a team lead step in on an employee-level incident', () => {
    assert.doesNotThrow(() =>
      assertCanAct(incident({ assignedTo: 'a', escalationLevel: 'EMPLOYEE' }), actor('lead', 'TEAM_LEAD'))
    );
  });

  test('blocks a second team lead from acting on a team-lead-level incident', () => {
    assert.throws(
      () => assertCanAct(incident({ assignedTo: 'lead1', escalationLevel: 'TEAM_LEAD' }), actor('lead2', 'TEAM_LEAD')),
      { code: 'NOT_AUTHORIZED' }
    );
  });

  test('lets a manager act on a team-lead-level incident', () => {
    assert.doesNotThrow(() =>
      assertCanAct(incident({ assignedTo: 'lead1', escalationLevel: 'TEAM_LEAD' }), actor('mgr', 'MANAGER'))
    );
  });

  test('blocks an employee on an unassigned employee-level incident', () => {
    assert.throws(
      () => assertCanAct(incident({ assignedTo: null, escalationLevel: 'EMPLOYEE' }), actor('a', 'EMPLOYEE')),
      { code: 'NOT_AUTHORIZED' }
    );
  });
});
