import client from './client';

export function listIncidents() {
  return client.get('/incidents');
}

export function createIncident(data) {
  return client.post('/incidents', data);
}

export function getIncident(incidentId) {
  return client.get(`/incidents/${incidentId}`);
}

export function getIncidentHistory(incidentId) {
  return client.get(`/incidents/${incidentId}/history`);
}

export function assignIncident(incidentId, assigneeId) {
  return client.post(`/incidents/${incidentId}/assign`, { assigneeId });
}

export function acknowledgeIncident(incidentId) {
  return client.post(`/incidents/${incidentId}/acknowledge`);
}

export function resolveIncident(incidentId) {
  return client.post(`/incidents/${incidentId}/resolve`);
}
