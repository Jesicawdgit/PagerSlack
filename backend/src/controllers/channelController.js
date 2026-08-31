const channelService = require('../services/channelService');

async function getChannel(req, res) {
  const channel = await channelService.getChannelById(req.params.id);
  res.status(200).json({ success: true, data: { channel } });
}

module.exports = { getChannel };
