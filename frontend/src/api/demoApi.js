import client from './client';

export function listServices() {
  return client.get('/demo/services');
}

export function failService(serviceId) {
  return client.post(`/demo/services/${serviceId}/fail`);
}

export function restoreService(serviceId) {
  return client.post(`/demo/services/${serviceId}/restore`);
}

export function getOrders() {
  return client.get('/demo/orders');
}
