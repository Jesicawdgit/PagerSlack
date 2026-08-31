import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import * as teamApi from '../../api/teamApi';
import Sidebar from './Sidebar';
import Toast from '../common/Toast';

export default function AppLayout() {
  const { user } = useAuth();
  const socket = useSocket();
  const [team, setTeam] = useState(null);
  const [channels, setChannels] = useState([]);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = user.team
      ? Promise.all([teamApi.getTeam(user.team), teamApi.listChannels(user.team)]).then(
          ([teamRes, channelsRes]) => ({
            team: teamRes.data.data.team,
            channels: channelsRes.data.data.channels,
          })
        )
      : Promise.resolve({ team: null, channels: [] });

    fetchData.then((result) => {
      if (cancelled) return;
      setTeam(result.team);
      setChannels(result.channels);
    });

    return () => {
      cancelled = true;
    };
  }, [user.team]);

  async function handleCreateChannel(name) {
    const res = await teamApi.createChannel(user.team, { name });
    setChannels((prev) => [...prev, res.data.data.channel]);
  }

  useEffect(() => {
    if (!socket) return undefined;

    function handleNotification(notification) {
      const text = `${notification.fromUser.name} mentioned you in #${notification.channel.name}`;
      setToasts((prev) => [...prev, { id: notification._id, text }]);
    }

    socket.on('notification:new', handleNotification);
    return () => socket.off('notification:new', handleNotification);
  }, [socket]);

  function dismissToast(id) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <Sidebar team={team} channels={channels} onCreateChannel={handleCreateChannel} />
      <div className="flex-grow-1">
        <Outlet />
      </div>
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }}>
        {toasts.map((toast) => (
          <Toast key={toast.id} text={toast.text} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}
