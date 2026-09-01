const DemoService = require('../models/DemoService');
const ApiError = require('../utils/ApiError');
const { getIO } = require('../sockets/socketServer');

const ORDER_API_NAME = 'Order API';

const FAKE_ORDERS = [
  { id: 'ORD-1001', item: 'Wireless Mouse', status: 'SHIPPED' },
  { id: 'ORD-1002', item: 'Mechanical Keyboard', status: 'PROCESSING' },
  { id: 'ORD-1003', item: 'USB-C Hub', status: 'DELIVERED' },
];

async function assertServiceExists(id) {
  const service = await DemoService.findById(id);
  if (!service) {
    throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Demo service not found');
  }
  return service;
}

async function listServices() {
  return DemoService.find();
}

async function setServiceStatus(id, status) {
  const service = await assertServiceExists(id);
  service.status = status;
  await service.save();
  getIO().emit('service:health_changed', service);
  return service;
}

async function failService(id) {
  return setServiceStatus(id, 'FAILING');
}

async function restoreService(id) {
  return setServiceStatus(id, 'HEALTHY');
}

async function getOrders() {
  const orderApi = await DemoService.findOne({ name: ORDER_API_NAME });
  if (orderApi && orderApi.status === 'FAILING') {
    throw new ApiError(500, 'SERVICE_UNAVAILABLE', 'Order API is currently unavailable');
  }
  return FAKE_ORDERS;
}

module.exports = { listServices, failService, restoreService, getOrders };
