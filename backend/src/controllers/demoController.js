const demoService = require('../services/demoService');

async function listServices(req, res) {
  const services = await demoService.listServices();
  res.status(200).json({ success: true, data: { services } });
}

async function failService(req, res) {
  const service = await demoService.failService(req.params.id);
  res.status(200).json({ success: true, data: { service } });
}

async function restoreService(req, res) {
  const service = await demoService.restoreService(req.params.id);
  res.status(200).json({ success: true, data: { service } });
}

async function getOrders(req, res) {
  const orders = await demoService.getOrders();
  res.status(200).json({ success: true, data: { orders } });
}

module.exports = { listServices, failService, restoreService, getOrders };
