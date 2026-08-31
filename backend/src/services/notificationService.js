const Notification = require('../models/Notification');
const { emitNotification } = require('../sockets/notificationEvents');

async function createMentionNotifications({ channelId, messageId, fromUserId, mentionedUserIds }) {
  const notifications = await Notification.insertMany(
    mentionedUserIds.map((recipient) => ({
      recipient,
      type: 'MENTION',
      channel: channelId,
      fromUser: fromUserId,
      message: messageId,
    }))
  );

  for (const notification of notifications) {
    await notification.populate([
      { path: 'fromUser', select: 'name' },
      { path: 'channel', select: 'name' },
    ]);
    emitNotification(notification);
  }
}

module.exports = { createMentionNotifications };
