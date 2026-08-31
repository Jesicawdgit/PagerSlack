const { getIO } = require('./socketServer');

function emitNotification(notification) {
  getIO().to(`user:${notification.recipient}`).emit('notification:new', notification);
}

module.exports = { emitNotification };
