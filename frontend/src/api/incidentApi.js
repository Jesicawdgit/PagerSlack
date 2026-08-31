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
