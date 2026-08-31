import Badge from '../common/Badge';
import { severityVariant } from '../../utils/severity';

export default function IncidentHeader({ incident }) {
  return (
    <div className="mb-4">
      <div className="text-secondary small mb-1">
        {incident.incidentNumber} · # {incident.channel?.name}
      </div>
      <h2 className="h4 mb-3">{incident.title}</h2>
      <div className="d-flex gap-2 mb-3">
        <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
        <Badge variant="accent">{incident.status}</Badge>
        <Badge variant="role">{incident.escalationLevel}</Badge>
      </div>
      <p>{incident.description}</p>
      <p className="text-secondary small mb-0">Reported by {incident.createdBy?.name}</p>
      <p className="text-secondary small">Assigned to {incident.assignedTo?.name ?? 'nobody yet'}</p>
    </div>
  );
}
