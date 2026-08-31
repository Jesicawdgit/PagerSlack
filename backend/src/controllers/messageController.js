const messageService = require('../services/messageService');

async function listMessages(req, res) {
  const messages = await messageService.listMessagesByChannel(req.params.id);
  res.status(200).json({ success: true, data: { messages } });
}

async function createMessage(req, res) {
  const message = await messageService.createMessage({
    channelId: req.params.id,
    authorId: req.user._id,
    content: req.body.content,
  });
  res.status(201).json({ success: true, data: { message } });
}

module.exports = { listMessages, createMessage };
