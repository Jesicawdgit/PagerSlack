import MessageItem from './MessageItem';

export default function MessageList({ messages }) {
  return (
    <div className="flex-grow-1 overflow-auto p-3">
      {messages.map((message) => (
        <MessageItem key={message._id} message={message} />
      ))}
    </div>
  );
}
