const teamService = require('../services/teamService');
const channelService = require('../services/channelService');

async function listTeams(req, res) {
  const teams = await teamService.listTeams();
  res.status(200).json({ success: true, data: { teams } });
}

async function createTeam(req, res) {
  const { name } = req.body;
  const team = await teamService.createTeam({ name, creatorId: req.user._id });
  res.status(201).json({ success: true, data: { team } });
}

async function getTeam(req, res) {
  const team = await teamService.getTeamById(req.params.id);
  res.status(200).json({ success: true, data: { team } });
}

async function listChannels(req, res) {
  const channels = await channelService.listChannelsByTeam(req.params.teamId);
  res.status(200).json({ success: true, data: { channels } });
}

async function createChannel(req, res) {
  const { name } = req.body;
  const channel = await channelService.createChannel({ name, teamId: req.params.teamId });
  res.status(201).json({ success: true, data: { channel } });
}

module.exports = { listTeams, createTeam, getTeam, listChannels, createChannel };
