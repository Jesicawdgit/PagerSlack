import client from './client';

export function listMessages(channelId) {
  return client.get(`/channels/${channelId}/messages`);
}

export function createMessage(channelId, content) {
  return client.post(`/channels/${channelId}/messages`, { content });
}
