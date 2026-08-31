const Channel = require('../models/Channel');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');

async function assertTeamExists(teamId) {
  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }
  return team;
}

async function listChannelsByTeam(teamId) {
  await assertTeamExists(teamId);
  return Channel.find({ team: teamId });
}

async function createChannel({ name, teamId }) {
  await assertTeamExists(teamId);

  const existing = await Channel.findOne({ team: teamId, name });
  if (existing) {
    throw new ApiError(409, 'CHANNEL_NAME_TAKEN', 'A channel with this name already exists on this team');
  }

  return Channel.create({ name, team: teamId });
}

async function getChannelById(id) {
  const channel = await Channel.findById(id);
  if (!channel) {
    throw new ApiError(404, 'CHANNEL_NOT_FOUND', 'Channel not found');
  }
  return channel;
}

module.exports = { listChannelsByTeam, createChannel, getChannelById };
