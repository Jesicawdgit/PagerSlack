const mongoose = require('mongoose');

const EVENT_TYPES = ['CREATED'];

const incidentEventSchema = new mongoose.Schema(
  {
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

incidentEventSchema.index({ incident: 1, createdAt: 1 });

const IncidentEvent = mongoose.model('IncidentEvent', incidentEventSchema);

module.exports = IncidentEvent;
module.exports.EVENT_TYPES = EVENT_TYPES;
