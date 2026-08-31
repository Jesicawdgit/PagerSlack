const Incident = require('../models/Incident');
const IncidentEvent = require('../models/IncidentEvent');
const Channel = require('../models/Channel');
const ApiError = require('../utils/ApiError');
const generateIncidentNumber = require('../utils/generateIncidentNumber');

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

async function createIncident({ title, description, severity, channelId, createdById }) {
  await assertChannelExists(channelId);

  const incidentNumber = await generateIncidentNumber();
  const incident = await Incident.create({
    incidentNumber,
    title,
    description,
    severity,
    channel: channelId,
    createdBy: createdById,
  });

  await IncidentEvent.create({ incident: incident._id, type: 'CREATED', actor: createdById });

  return incident.populate([
    { path: 'channel', select: 'name' },
    { path: 'createdBy', select: 'name' },
  ]);
}

async function listIncidents() {
  return Incident.find()
    .sort({ createdAt: -1 })
    .populate('channel', 'name')
    .populate('createdBy', 'name');
}

async function getIncidentById(incidentId) {
  const incident = await assertIncidentExists(incidentId);
  return incident.populate([
    { path: 'channel', select: 'name' },
    { path: 'createdBy', select: 'name' },
  ]);
}

async function listIncidentHistory(incidentId) {
  await assertIncidentExists(incidentId);
  return IncidentEvent.find({ incident: incidentId }).sort({ createdAt: 1 }).populate('actor', 'name');
}

module.exports = { createIncident, listIncidents, getIncidentById, listIncidentHistory };
