const mongoose = require('mongoose');

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
const ESCALATION_LEVELS = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'];

const incidentSchema = new mongoose.Schema(
  {
    incidentNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    severity: { type: String, enum: SEVERITIES, required: true },
    status: { type: String, enum: STATUSES, default: 'OPEN' },
    escalationLevel: { type: String, enum: ESCALATION_LEVELS, default: 'EMPLOYEE' },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;
module.exports.SEVERITIES = SEVERITIES;
module.exports.STATUSES = STATUSES;
module.exports.ESCALATION_LEVELS = ESCALATION_LEVELS;
