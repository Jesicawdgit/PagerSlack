import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';
import Badge from '../common/Badge';

export default function Sidebar({ team, channels, onCreateChannel }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [newChannelName, setNewChannelName] = useState('');

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleCreateChannel(e) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    await onCreateChannel(newChannelName.trim());
    setNewChannelName('');
  }

  return (
    <div
      className="d-flex flex-column p-3 border-end"
      style={{ width: '260px', flexShrink: 0 }}
    >
      <div className="mb-3">
        {team ? (
          <NavLink to="/" end className="fw-semibold text-decoration-none">
            {team.name}
          </NavLink>
        ) : (
          <div className="fw-semibold">No team yet</div>
        )}
      </div>

      {team && (
        <NavLink
          to="/incidents"
          className={({ isActive }) =>
            `list-group-item list-group-item-action mb-3${isActive ? ' active' : ''}`
          }
        >
          Incidents
        </NavLink>
      )}

      {team && (
        <>
          <div className="text-secondary small text-uppercase mb-2">Channels</div>
          <div className="list-group list-group-flush mb-3">
            {channels.map((channel) => (
              <NavLink
                key={channel._id}
                to={`/channels/${channel._id}`}
                className={({ isActive }) =>
                  `list-group-item list-group-item-action${isActive ? ' active' : ''}`
                }
              >
                # {channel.name}
              </NavLink>
            ))}
          </div>

          <form onSubmit={handleCreateChannel} className="d-flex gap-2 mb-4">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="new-channel"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="btn-sm">
              Add
            </Button>
          </form>
        </>
      )}

      <div className="mt-auto pt-3 border-top">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div className="small fw-semibold">{user.name}</div>
            <Badge variant="role">{user.role}</Badge>
          </div>
          <Button variant="secondary" className="btn-sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
