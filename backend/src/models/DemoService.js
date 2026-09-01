const mongoose = require('mongoose');

const STATUSES = ['HEALTHY', 'FAILING'];

const demoServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: STATUSES, default: 'HEALTHY' },
  },
  { timestamps: true }
);

const DemoService = mongoose.model('DemoService', demoServiceSchema);

module.exports = DemoService;
module.exports.STATUSES = STATUSES;
