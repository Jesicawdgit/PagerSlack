import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import * as teamApi from '../../api/teamApi';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [channels, setChannels] = useState([]);

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

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <Sidebar team={team} channels={channels} onCreateChannel={handleCreateChannel} />
      <div className="flex-grow-1">
        <Outlet />
      </div>
    </div>
  );
}
