import { useState } from 'react';
import Button from '../common/Button';

export default function MessageInput({ onSend }) {
  const [content, setContent] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  }

  return (
    <form className="d-flex gap-2 p-3 border-top" onSubmit={handleSubmit}>
      <input
        className="form-control"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Message..."
      />
      <Button type="submit">Send</Button>
    </form>
  );
}
