import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as incidentApi from '../api/incidentApi';
import Badge from '../components/common/Badge';
import { severityVariant } from '../utils/severity';

export default function IncidentDetails() {
  const { incidentId } = useParams();
  const [incident, setIncident] = useState(null);

  useEffect(() => {
    let cancelled = false;
    incidentApi.getIncident(incidentId).then((res) => {
      if (!cancelled) setIncident(res.data.data.incident);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  if (!incident) return null;

  return (
    <div className="p-4">
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
      <p className="text-secondary small">Reported by {incident.createdBy?.name}</p>
    </div>
  );
}
