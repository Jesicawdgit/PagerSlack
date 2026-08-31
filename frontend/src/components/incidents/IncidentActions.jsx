import { useState } from 'react';
import Button from '../common/Button';
import * as incidentApi from '../../api/incidentApi';

export default function IncidentActions({ incident, members, pushToast }) {
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
              {member.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={handleAssign}>
          Assign
        </Button>
      </div>
      <div className="d-flex gap-2">
        {incident.status === 'OPEN' && <Button onClick={handleAcknowledge}>Acknowledge</Button>}
        <Button variant="secondary" onClick={handleResolve}>
          Resolve
        </Button>
      </div>
    </div>
  );
}
