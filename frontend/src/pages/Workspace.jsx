import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as teamApi from '../api/teamApi';
import Button from '../components/common/Button';

export default function Workspace() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateTeam(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await teamApi.createTeam({ name });
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user.team) {
    return (
      <div className="d-flex align-items-center justify-content-center p-4" style={{ minHeight: '100vh' }}>
        <div className="card shadow-sm" style={{ width: '100%', maxWidth: '380px' }}>
          <div className="card-body p-4">
            <h1 className="h5 mb-1">Create your team</h1>
            <p className="text-secondary small mb-4">You're not on a team yet.</p>

            {error && <div className="alert alert-danger py-2">{error}</div>}

            <form onSubmit={handleCreateTeam}>
              <div className="mb-3">
                <label className="form-label small" htmlFor="teamName">
                  Team name
                </label>
                <input
                  id="teamName"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-100" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create team'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center justify-content-center p-4" style={{ minHeight: '100vh' }}>
      <p className="text-secondary">Select a channel from the sidebar.</p>
    </div>
  );
}
