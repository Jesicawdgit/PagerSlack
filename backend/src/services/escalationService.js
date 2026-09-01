const Incident = require('../models/Incident');
const IncidentEvent = require('../models/IncidentEvent');
const User = require('../models/User');
const logger = require('../utils/logger');
const env = require('../config/environment');
const { emitIncidentEvent, emitIncidentEventToUser } = require('../sockets/incidentEvents');
const { INCIDENT_POPULATE } = require('./incidentService');
const messageService = require('./messageService');
const { SEEDED_USER_EMAILS } = require('../config/constants');

const ESCALATION_ORDER = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'];

async function findUnassignedIncidents() {
  const cutoff = new Date(Date.now() - env.AUTO_ASSIGN_WINDOW_MS);
  return Incident.find({
    status: 'OPEN',
    assignedTo: null,
    createdAt: { $lte: cutoff },
  }).populate('channel', 'name');
}

async function autoAssignToEmployee(incident) {
  const employee = await User.findOne({ email: SEEDED_USER_EMAILS.EMPLOYEE });
  if (!employee) {
    logger.warn(`Auto-assign skipped for ${incident.incidentNumber}: seeded EMPLOYEE not found`);
    return;
  }

  incident.assignedTo = employee._id;
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
  }).populate('channel', 'name');
}

async function escalateIncident(incident) {
  const currentIndex = ESCALATION_ORDER.indexOf(incident.escalationLevel);
  const nextLevel = ESCALATION_ORDER[currentIndex + 1];
  const nextUser = await User.findOne({ email: SEEDED_USER_EMAILS[nextLevel] });

  if (!nextUser) {
    logger.warn(`Escalation skipped for ${incident.incidentNumber}: seeded ${nextLevel} not found`);
    return;
  }

  incident.escalationLevel = nextLevel;
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
  findUnassignedIncidents,
  autoAssignToEmployee,
  runAutoAssignSweep,
  findEscalatableIncidents,
  escalateIncident,
  runEscalationSweep,
};
