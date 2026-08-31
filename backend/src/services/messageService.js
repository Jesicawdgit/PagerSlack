const Message = require('../models/Message');
const Channel = require('../models/Channel');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getIO } = require('../sockets/socketServer');
const notificationService = require('./notificationService');

async function assertChannelExists(channelId) {
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new ApiError(404, 'CHANNEL_NOT_FOUND', 'Channel not found');
  }
  return channel;
}

async function resolveMentions(content, teamId, authorId) {
  const mentioned = [...content.matchAll(/@(\w+)/g)].map((match) => match[1].toLowerCase());
  if (mentioned.length === 0) return [];

  const members = await User.find({ team: teamId });
  const mentionedUserIds = new Set();

  for (const member of members) {
    if (member._id.toString() === authorId.toString()) continue;
    const firstName = member.name.split(' ')[0].toLowerCase();
    if (mentioned.includes(firstName)) {
      mentionedUserIds.add(member._id.toString());
    }
  }

  return [...mentionedUserIds];
}

async function listMessagesByChannel(channelId) {
  await assertChannelExists(channelId);
  return Message.find({ channel: channelId }).sort({ createdAt: 1 }).populate('author', 'name');
}

async function createMessage({ channelId, authorId, content }) {
  const channel = await assertChannelExists(channelId);

  const message = await Message.create({ channel: channelId, author: authorId, content });
  await message.populate('author', 'name');

  getIO().to(`channel:${channelId}`).emit('message:new', message);

  const mentionedUserIds = await resolveMentions(content, channel.team, authorId);
  if (mentionedUserIds.length > 0) {
    await notificationService.createMentionNotifications({
      channelId,
      messageId: message._id,
      fromUserId: authorId,
      mentionedUserIds,
    });
  }

  return message;
}

module.exports = { listMessagesByChannel, createMessage };
