import { formatTime } from '../../utils/formatDate';

function describeEvent(event) {
  switch (event.type) {
    case 'CREATED':
      return `${event.actor?.name} reported this incident`;
    case 'ASSIGNED':
      return `${event.actor?.name} assigned this to ${event.targetUser?.name ?? 'someone'}`;
    case 'AUTO_ASSIGNED':
      return `Automatically assigned to ${event.targetUser?.name ?? 'someone'} (no manual assignment in time)`;
    case 'ACKNOWLEDGED':
      return `${event.actor?.name} acknowledged this incident`;
    case 'RESOLVED':
      return `${event.actor?.name} resolved this incident`;
    case 'ESCALATED':
      return `Automatically escalated to ${event.targetUser?.name ?? 'someone'}`;
    default:
      return event.type;
  }
}

export default function IncidentTimeline({ events }) {
  return (
    <div>
      <h3 className="h6 text-secondary text-uppercase mb-2">Timeline</h3>
      {events.map((event) => (
        <div key={event._id} className="mb-2">
          <span>{describeEvent(event)}</span>
          <span className="text-secondary small ms-2">{formatTime(event.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
