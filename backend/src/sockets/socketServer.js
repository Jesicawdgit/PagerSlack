const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/environment');
const logger = require('../utils/logger');

let io = null;

function initSocketServer(server) {
  io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.engine.use(cookieParser());

  io.use(async (socket, next) => {
    const token = socket.request.cookies.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.sub);
      if (!user) {
        return next(new Error('Authentication required'));
      }
      socket.userId = user._id.toString();
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('channel:join', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('channel:leave', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = { initSocketServer, getIO };
