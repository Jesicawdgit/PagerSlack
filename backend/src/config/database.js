const mongoose = require('mongoose');
const env = require('./environment');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err.message); //error handling
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB initial connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;