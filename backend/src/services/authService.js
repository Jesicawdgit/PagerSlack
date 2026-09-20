const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');
const env = require('../config/environment');
const { SEEDED_TEAM_NAME } = require('../config/constants');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mentions and "@FirstName" system messages match on first name, so two people on the
// team sharing one would both get pinged and assignments would be ambiguous.
async function assertFirstNameFree(name) {
  const firstName = name.trim().split(/\s+/)[0];
  const clash = await User.findOne({ name: new RegExp(`^${escapeRegex(firstName)}(\\s|$)`, 'i') });
  if (clash) {
    throw new ApiError(
      409,
      'NAME_TAKEN',
      `Someone named ${firstName} is already on the team — use a different first name so @mentions stay unambiguous`
    );
  }
}

async function registerUser({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  await assertFirstNameFree(name);

  const team = await Team.findOne({ name: SEEDED_TEAM_NAME });
  if (!team) {
    throw new ApiError(500, 'TEAM_NOT_FOUND', 'No team exists to join yet — run the seed script first');
  }

  const hashed = await hashPassword(password);
  const user = await User.create({ name, email, password: hashed, role, team: team._id });

  team.members.push(user._id);
  await team.save();

  return user;
}

async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return user;
}

function generateToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

module.exports = { registerUser, loginUser, generateToken, hashPassword, TOKEN_EXPIRY };
