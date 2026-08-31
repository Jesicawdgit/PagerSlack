const incidentService = require('../services/incidentService');

async function listIncidents(req, res) {
  const incidents = await incidentService.listIncidents();
  res.status(200).json({ success: true, data: { incidents } });
}

async function createIncident(req, res) {
  const { title, description, severity, channel } = req.body;
  const incident = await incidentService.createIncident({
    title,
    description,
    severity,
    channelId: channel,
    createdById: req.user._id,
  });
  res.status(201).json({ success: true, data: { incident } });
}

async function getIncident(req, res) {
  const incident = await incidentService.getIncidentById(req.params.id);
  res.status(200).json({ success: true, data: { incident } });
}

async function getIncidentHistory(req, res) {
  const events = await incidentService.listIncidentHistory(req.params.id);
  res.status(200).json({ success: true, data: { events } });
}

module.exports = { listIncidents, createIncident, getIncident, getIncidentHistory };
