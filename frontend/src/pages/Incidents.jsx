import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as incidentApi from '../api/incidentApi';
import IncidentList from '../components/incidents/IncidentList';
import CreateIncidentModal from '../components/incidents/CreateIncidentModal';
import Button from '../components/common/Button';

export default function Incidents() {
  const { channels, pushToast } = useOutletContext();
  const [incidents, setIncidents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    incidentApi.listIncidents().then((res) => {
      if (!cancelled) setIncidents(res.data.data.incidents);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(incident) {
    setIncidents((prev) => [incident, ...prev]);
  }

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Incidents</h2>
        <Button onClick={() => setIsModalOpen(true)}>Create Incident</Button>
      </div>
      <IncidentList incidents={incidents} />
      <CreateIncidentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        channels={channels}
        onCreated={handleCreated}
        pushToast={pushToast}
      />
    </div>
  );
}
