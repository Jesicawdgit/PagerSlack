import client from './client';

export function listTeams() {
  return client.get('/teams');
}

export function createTeam({ name }) {
  return client.post('/teams', { name });
}

export function getTeam(teamId) {
  return client.get(`/teams/${teamId}`);
}

export function listChannels(teamId) {
  return client.get(`/teams/${teamId}/channels`);
}

export function createChannel(teamId, { name }) {
  return client.post(`/teams/${teamId}/channels`, { name });
}
