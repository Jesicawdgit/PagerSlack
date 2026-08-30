import { useEffect, useState } from 'react';
import client from './api/client';
import './App.css';

function App() {
  const [status, setStatus] = useState('checking');
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let cancelled = false;

    client
      .get('/health')
      .then((res) => {
        if (cancelled) return;
        setStatus('online');
        setDetails(res.data.data);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('offline');
        setDetails(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="status-page">
      <h1>PagerSlack</h1>
      <div className={`status-card status-${status}`}>
        {status === 'checking' && <p>Checking backend...</p>}
        {status === 'online' && (
          <>
            <p className="status-label">Backend Online</p>
            <p className="status-meta">
              env: {details?.env} · {details?.timestamp}
            </p>
          </>
        )}
        {status === 'offline' && <p className="status-label">Backend Offline</p>}
      </div>
    </div>
  );
}

export default App;