const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/environment');

async function protect(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    throw new ApiError(401, 'NO_TOKEN', 'Authentication required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Session expired or invalid, please log in again');
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Session expired or invalid, please log in again');
  }

  req.user = user;
  next();
}

module.exports = { protect };
