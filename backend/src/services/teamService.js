const Team = require('../models/Team');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

async function listTeams() {
  return Team.find();
}

async function createTeam({ name, creatorId }) {
  const existingName = await Team.findOne({ name });
  if (existingName) {
    throw new ApiError(409, 'TEAM_NAME_TAKEN', 'A team with this name already exists');
  }

  const creator = await User.findById(creatorId);
  if (creator.team) {
    throw new ApiError(409, 'ALREADY_ON_TEAM', 'You already belong to a team');
  }

  const team = await Team.create({ name, createdBy: creatorId, members: [creatorId] });
  creator.team = team._id;
  await creator.save();

  return team;
}

async function getTeamById(id) {
  const team = await Team.findById(id);
  if (!team) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }
  const members = await User.find({ team: id }, 'name role');
  return { ...team.toObject(), members };
}

module.exports = { listTeams, createTeam, getTeamById };
