import IncidentCard from './IncidentCard';

export default function IncidentList({ incidents }) {
  if (incidents.length === 0) {
    return <p className="text-secondary">No incidents yet.</p>;
  }

  return (
    <div>
      {incidents.map((incident) => (
        <IncidentCard key={incident._id} incident={incident} />
      ))}
    </div>
  );
}
