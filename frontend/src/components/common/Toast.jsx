import { useEffect } from 'react';

export default function Toast({ text, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 8000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return <div className="toast-mention shadow-sm rounded px-3 py-2 mb-2">{text}</div>;
}
