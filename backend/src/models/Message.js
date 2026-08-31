const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

messageSchema.index({ channel: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
