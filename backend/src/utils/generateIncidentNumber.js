const Incident = require('../models/Incident');

async function generateIncidentNumber() {
  const count = await Incident.countDocuments();
  return `INC-${String(count + 1).padStart(4, '0')}`;
}

module.exports = generateIncidentNumber;
