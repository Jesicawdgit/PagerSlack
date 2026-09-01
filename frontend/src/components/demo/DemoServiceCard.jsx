import { useEffect, useState } from 'react';
import * as demoApi from '../../api/demoApi';
import { useSocket } from '../../hooks/useSocket';
import Button from '../common/Button';
import Badge from '../common/Badge';

export default function DemoServiceCard() {
  const socket = useSocket();
  const [service, setService] = useState(null);
  const [orderResult, setOrderResult] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    demoApi.listServices().then((res) => {
      setService(res.data.data.services[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    function handleHealthChanged(updated) {
      setService((prev) => (prev && prev._id === updated._id ? updated : prev));
    }

    socket.on('service:health_changed', handleHealthChanged);
    return () => socket.off('service:health_changed', handleHealthChanged);
  }, [socket]);

  async function handleFail() {
    setBusy(true);
    try {
      await demoApi.failService(service._id);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      await demoApi.restoreService(service._id);
    } finally {
      setBusy(false);
    }
  }

  async function handleTestOrders() {
    setOrderResult('Loading...');
    try {
      const res = await demoApi.getOrders();
      setOrderResult(`${res.data.data.orders.length} orders returned`);
    } catch (err) {
      setOrderResult(err.response?.data?.error?.message ?? 'Request failed');
    }
  }

  if (!service) return null;

  const isHealthy = service.status === 'HEALTHY';

  return (
    <div className="card shadow-sm" style={{ width: '100%', maxWidth: '380px' }}>
      <div className="card-body p-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="fw-semibold">{service.name}</div>
          <Badge variant={isHealthy ? 'severity-low' : 'severity-critical'}>{service.status}</Badge>
        </div>

        <div className="d-flex gap-2 mb-3">
          <Button variant="secondary" className="btn-sm" onClick={handleFail} disabled={busy || !isHealthy}>
            Fail
          </Button>
          <Button variant="secondary" className="btn-sm" onClick={handleRestore} disabled={busy || isHealthy}>
            Restore
          </Button>
        </div>

        <Button variant="primary" className="btn-sm w-100" onClick={handleTestOrders}>
          Test Order API
        </Button>
        {orderResult && <div className="text-secondary small mt-2">{orderResult}</div>}
      </div>
    </div>
  );
}
