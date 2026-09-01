const { getIO } = require('./socketServer');

function emitIncidentEvent(eventName, channelId, incident) {
  getIO().to(`channel:${channelId}`).emit(eventName, incident);
}

function emitIncidentEventToUser(eventName, userId, incident) {
  getIO().to(`user:${userId}`).emit(eventName, incident);
}

module.exports = { emitIncidentEvent, emitIncidentEventToUser };
