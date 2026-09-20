const Incident = require('../models/Incident');
const IncidentEvent = require('../models/IncidentEvent');
const Team = require('../models/Team');
const User = require('../models/User');
const logger = require('../utils/logger');
const env = require('../config/environment');
const { emitIncidentEvent, emitIncidentEventToUser } = require('../sockets/incidentEvents');
const { INCIDENT_POPULATE } = require('./incidentService');
const messageService = require('./messageService');

const ESCALATION_ORDER = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'];

// Round-robin: the candidate after `lastId`, wrapping around. An unknown or empty cursor
// starts at the first candidate. `candidates` must already be in a stable order.
function chooseNextCandidate(candidates, lastId) {
  const lastIndex = candidates.findIndex((user) => user._id.toString() === lastId);
  return candidates[(lastIndex + 1) % candidates.length];
}

// Picks who receives an incident, starting at `startLevel` and moving up the ladder past any
// level with nobody available. Returns { user, level }, or null if no level has anyone.
async function pickAssigneeForLevel(teamId, startLevel, excludeUserId) {
  const team = await Team.findById(teamId);
  if (!team) return null;

  for (let i = ESCALATION_ORDER.indexOf(startLevel); i < ESCALATION_ORDER.length; i += 1) {
    const level = ESCALATION_ORDER[i];
    const members = await User.find({ team: teamId, role: level }).sort({ createdAt: 1, _id: 1 });
    const candidates = members.filter(
      (user) => !excludeUserId || user._id.toString() !== excludeUserId.toString()
    );
    if (candidates.length === 0) continue;

    const lastId = team.rotation?.[level]?.toString();
    const next = chooseNextCandidate(candidates, lastId);
    await Team.updateOne({ _id: teamId }, { $set: { [`rotation.${level}`]: next._id } });
    return { user: next, level };
  }

  return null;
}

async function findUnassignedIncidents() {
  const cutoff = new Date(Date.now() - env.AUTO_ASSIGN_WINDOW_MS);
  return Incident.find({
    status: 'OPEN',
    assignedTo: null,
    createdAt: { $lte: cutoff },
  }).populate('channel', 'name team');
}

async function autoAssignToEmployee(incident) {
  const picked = await pickAssigneeForLevel(incident.channel.team, 'EMPLOYEE');
  if (!picked) {
    logger.warn(`Auto-assign skipped for ${incident.incidentNumber}: nobody on the team to assign to`);
    return;
  }
  const employee = picked.user;

  incident.assignedTo = employee._id;
  incident.escalationLevel = picked.level;
  incident.levelChangedAt = new Date();
  await incident.save();

  await IncidentEvent.create({
    incident: incident._id,
    type: 'AUTO_ASSIGNED',
    actor: null,
    targetUser: employee._id,
  });

  const populated = await incident.populate(INCIDENT_POPULATE);
  emitIncidentEvent('incident:updated', populated.channel._id, populated);

  const firstName = employee.name.split(' ')[0];
  await messageService.createMessage({
    channelId: populated.channel._id,
    authorId: populated.createdBy._id,
    content: `🔔 ${incident.incidentNumber} automatically assigned to @${firstName} (no manual assignment within ${env.AUTO_ASSIGN_WINDOW_MS / 1000}s)`,
  });
}

async function runAutoAssignSweep() {
  const incidents = await findUnassignedIncidents();
  for (const incident of incidents) {
    await autoAssignToEmployee(incident);
  }
}

async function findEscalatableIncidents() {
  const cutoff = new Date(Date.now() - env.ESCALATION_ACK_WINDOW_MS);
  return Incident.find({
    status: 'OPEN',
    escalationLevel: { $ne: 'MANAGER' },
    levelChangedAt: { $lte: cutoff },
  }).populate('channel', 'name team');
}

async function escalateIncident(incident) {
  const currentIndex = ESCALATION_ORDER.indexOf(incident.escalationLevel);
  const nextLevel = ESCALATION_ORDER[currentIndex + 1];
  const picked = await pickAssigneeForLevel(incident.channel.team, nextLevel, incident.assignedTo);

  if (!picked) {
    logger.warn(`Escalation skipped for ${incident.incidentNumber}: nobody at or above ${nextLevel} to escalate to`);
    return;
  }
  const nextUser = picked.user;

  incident.escalationLevel = picked.level;
  incident.assignedTo = nextUser._id;
  incident.levelChangedAt = new Date();
  await incident.save();

  await IncidentEvent.create({
    incident: incident._id,
    type: 'ESCALATED',
    actor: null,
    targetUser: nextUser._id,
  });

  const populated = await incident.populate(INCIDENT_POPULATE);

  emitIncidentEvent('incident:escalated', populated.channel._id, populated);
  emitIncidentEventToUser('incident:escalated', nextUser._id, populated);
}

async function runEscalationSweep() {
  await runAutoAssignSweep();

  const incidents = await findEscalatableIncidents();
  for (const incident of incidents) {
    await escalateIncident(incident);
  }
}

module.exports = {
  chooseNextCandidate,
  pickAssigneeForLevel,
  findUnassignedIncidents,
  autoAssignToEmployee,
  runAutoAssignSweep,
  findEscalatableIncidents,
  escalateIncident,
  runEscalationSweep,
};
