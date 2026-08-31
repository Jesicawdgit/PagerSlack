import { formatTime } from '../../utils/formatDate';

function renderContent(content) {
  return content.split(/(@\w+)/g).map((part, index) =>
    /^@\w+$/.test(part) ? (
      <span key={index} className="mention-highlight">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export default function MessageItem({ message }) {
  return (
    <div className="mb-2">
      <span className="fw-semibold me-2">{message.author?.name ?? 'Unknown'}</span>
      <span className="text-secondary small">{formatTime(message.createdAt)}</span>
      <div>{renderContent(message.content)}</div>
    </div>
  );
}
