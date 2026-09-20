const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Round-robin cursor: the last user the escalation worker assigned at each level.
    rotation: {
      EMPLOYEE: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      TEAM_LEAD: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      MANAGER: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
