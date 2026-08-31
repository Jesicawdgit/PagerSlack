const { getIO } = require('./socketServer');

function emitIncidentEvent(eventName, channelId, incident) {
  getIO().to(`channel:${channelId}`).emit(eventName, incident);
}

module.exports = { emitIncidentEvent };
