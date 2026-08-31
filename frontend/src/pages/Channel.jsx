import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as channelApi from '../api/channelApi';

export default function Channel() {
  const { channelId } = useParams();
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    channelApi.getChannel(channelId).then((res) => {
      if (!cancelled) setChannel(res.data.data.channel);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  if (!channel) return null;

  return (
    <div className="p-4">
      <h2 className="h5 mb-3"># {channel.name}</h2>
      <p className="text-secondary">Messages coming soon.</p>
    </div>
  );
}
