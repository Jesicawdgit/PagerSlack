import client from './client';

export function getChannel(channelId) {
  return client.get(`/channels/${channelId}`);
}
