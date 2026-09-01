const Incident = require('../models/Incident');
const IncidentEvent = require('../models/IncidentEvent');
const Channel = require('../models/Channel');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const generateIncidentNumber = require('../utils/generateIncidentNumber');
const { emitIncidentEvent } = require('../sockets/incidentEvents');
const messageService = require('./messageService');

const INCIDENT_POPULATE = [
  { path: 'channel', select: 'name' },
  { path: 'createdBy', select: 'name' },
  { path: 'assignedTo', select: 'name' },
];

async function assertChannelExists(channelId) {
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new ApiError(404, 'CHANNEL_NOT_FOUND', 'Channel not found');
  }
  return channel;
}

async function assertIncidentExists(incidentId) {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  }
  return incident;
}

async function assertUserExists(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return user;
}

function assertNotResolved(incident) {
  if (incident.status === 'RESOLVED') {
    throw new ApiError(409, 'INCIDENT_RESOLVED', 'This incident is already resolved');
  }
}

const ROLE_RANK = { EMPLOYEE: 0, TEAM_LEAD: 1, MANAGER: 2 };

function assertCanAct(incident, actor) {
  const isAssignee = incident.assignedTo && incident.assignedTo.toString() === actor._id.toString();
  const hasEqualOrHigherRole = ROLE_RANK[actor.role] >= ROLE_RANK[incident.escalationLevel];

  if (!isAssignee && !hasEqualOrHigherRole) {
    throw new ApiError(
      403,
      'NOT_AUTHORIZED',
      'Only the assignee, or someone at an equal or higher role than this incident\'s escalation level, can do this'
    );
  }
}

async function createIncident({ title, description, severity, channelId, createdById }) {
  await assertChannelExists(channelId);
  const creator = await assertUserExists(createdById);

  const incidentNumber = await generateIncidentNumber();
  const incident = await Incident.create({
    incidentNumber,
    title,
    description,
    severity,
    channel: channelId,
    createdBy: createdById,
    assignedTo: creator.role === 'EMPLOYEE' ? createdById : null,
  });

  await IncidentEvent.create({ incident: incident._id, type: 'CREATED', actor: createdById });

  await messageService.createMessage({
    channelId,
    authorId: createdById,
    content: `🔔 Reported incident ${incidentNumber}: ${title} (${severity})`,
  });

  return incident.populate(INCIDENT_POPULATE);
}

async function listIncidents() {
  return Incident.find().sort({ createdAt: -1 }).populate(INCIDENT_POPULATE);
}

async function getIncidentById(incidentId) {
  const incident = await assertIncidentExists(incidentId);
  return incident.populate(INCIDENT_POPULATE);
}

async function listIncidentHistory(incidentId) {
  await assertIncidentExists(incidentId);
  return IncidentEvent.find({ incident: incidentId })
    .sort({ createdAt: 1 })
    .populate('actor', 'name')
    .populate('targetUser', 'name');
}

async function assignIncident({ incidentId, assigneeId, actorId }) {
  const incident = await assertIncidentExists(incidentId);
  assertNotResolved(incident);
  const assignee = await assertUserExists(assigneeId);

  const isFirstAssignment = !incident.assignedTo && incident.escalationLevel === 'EMPLOYEE';
  incident.assignedTo = assigneeId;
  if (isFirstAssignment) {
    incident.levelChangedAt = new Date();
  }
  await incident.save();

  await IncidentEvent.create({
    incident: incident._id,
    type: 'ASSIGNED',
    actor: actorId,
    targetUser: assigneeId,
  });

  await incident.populate(INCIDENT_POPULATE);
  emitIncidentEvent('incident:updated', incident.channel._id, incident);

  const firstName = assignee.name.split(' ')[0];
  await messageService.createMessage({
    channelId: incident.channel._id,
    authorId: actorId,
    content: `🔔 Assigned ${incident.incidentNumber} to @${firstName}`,
  });

  return incident;
}

async function acknowledgeIncident({ incidentId, actor }) {
  const incident = await assertIncidentExists(incidentId);
  assertNotResolved(incident);
  if (incident.status === 'ACKNOWLEDGED') {
    throw new ApiError(409, 'ALREADY_ACKNOWLEDGED', 'This incident is already acknowledged');
  }
  assertCanAct(incident, actor);

  incident.status = 'ACKNOWLEDGED';
  await incident.save();

  await IncidentEvent.create({ incident: incident._id, type: 'ACKNOWLEDGED', actor: actor._id });

  await incident.populate(INCIDENT_POPULATE);
  emitIncidentEvent('incident:acknowledged', incident.channel._id, incident);
  return incident;
}

async function resolveIncident({ incidentId, actor }) {
  const incident = await assertIncidentExists(incidentId);
  if (incident.status === 'RESOLVED') {
    throw new ApiError(409, 'ALREADY_RESOLVED', 'This incident is already resolved');
  }
  assertCanAct(incident, actor);

  incident.status = 'RESOLVED';
  await incident.save();

  await IncidentEvent.create({ incident: incident._id, type: 'RESOLVED', actor: actor._id });

  await incident.populate(INCIDENT_POPULATE);
  emitIncidentEvent('incident:resolved', incident.channel._id, incident);
  return incident;
}

module.exports = {
  createIncident,
  listIncidents,
  getIncidentById,
  listIncidentHistory,
  assignIncident,
  acknowledgeIncident,
  resolveIncident,
  INCIDENT_POPULATE,
};
