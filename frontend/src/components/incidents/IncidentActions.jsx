import { useState } from 'react';
import Button from '../common/Button';
import * as incidentApi from '../../api/incidentApi';
import { useAuth } from '../../hooks/useAuth';

const ROLE_LABELS = { EMPLOYEE: 'Employee', TEAM_LEAD: 'Team Lead', MANAGER: 'Manager' };
const ROLE_RANK = { EMPLOYEE: 0, TEAM_LEAD: 1, MANAGER: 2 };

// Mirrors the backend's assertCanAct so the buttons match what the API will allow.
// The backend still enforces it; this only avoids offering actions that would 403.
function canAct(incident, user) {
  const isAssignee = incident.assignedTo?._id === user._id;
  return isAssignee || ROLE_RANK[user.role] > ROLE_RANK[incident.escalationLevel];
}

export default function IncidentActions({ incident, members, pushToast }) {
  const { user } = useAuth();
  const [assigneeId, setAssigneeId] = useState(members[0]?._id ?? '');

  function handleError(err) {
    pushToast(err.response?.data?.error?.message ?? 'Something went wrong');
  }

  function handleAssign() {
    if (!assigneeId) return;
    incidentApi.assignIncident(incident._id, assigneeId).catch(handleError);
  }

  function handleAcknowledge() {
    incidentApi.acknowledgeIncident(incident._id).catch(handleError);
  }

  function handleResolve() {
    incidentApi.resolveIncident(incident._id).catch(handleError);
  }

  if (incident.status === 'RESOLVED') {
    return <p className="text-secondary">This incident is resolved.</p>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex gap-2">
        <select
          className="form-select"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          {members.map((member) => (
            <option key={member._id} value={member._id}>
              {member.name} ({ROLE_LABELS[member.role] ?? member.role})
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={handleAssign}>
          Assign
        </Button>
      </div>
      {canAct(incident, user) ? (
        <div className="d-flex gap-2">
          {incident.status === 'OPEN' && <Button onClick={handleAcknowledge}>Acknowledge</Button>}
          <Button variant="secondary" onClick={handleResolve}>
            Resolve
          </Button>
        </div>
      ) : (
        <p className="text-secondary small mb-0">
          Only {incident.assignedTo?.name ?? 'the assignee'} or someone in a higher role can acknowledge or resolve this.
        </p>
      )}
    </div>
  );
}
