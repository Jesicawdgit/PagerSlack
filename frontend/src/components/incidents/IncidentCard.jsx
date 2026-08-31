import { Link } from 'react-router-dom';
import Badge from '../common/Badge';
import { severityVariant } from '../../utils/severity';

export default function IncidentCard({ incident }) {
  return (
    <Link to={`/incidents/${incident._id}`} className="card mb-2 text-decoration-none text-body">
      <div className="card-body d-flex justify-content-between align-items-center">
        <div>
          <div className="text-secondary small">
            {incident.incidentNumber} · # {incident.channel?.name}
          </div>
          <div className="fw-semibold">{incident.title}</div>
        </div>
        <div className="d-flex gap-2">
          <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
          <Badge variant="accent">{incident.status}</Badge>
        </div>
      </div>
    </Link>
  );
}
