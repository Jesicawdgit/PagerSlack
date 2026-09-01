import { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import * as incidentApi from '../../api/incidentApi';
import { SEVERITIES } from '../../utils/severity';

export default function CreateIncidentModal({ isOpen, onClose, channels, onCreated, pushToast }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(SEVERITIES[0]);
  const [channel, setChannel] = useState(channels[0]?._id ?? '');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      pushToast('Enter a title to create an incident');
      return;
    }
    if (!channel) return;

    const res = await incidentApi.createIncident({
      title: title.trim(),
      description,
      severity,
      channel,
    });
    onCreated(res.data.data.incident);
    setTitle('');
    setDescription('');
    setSeverity(SEVERITIES[0]);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Incident">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="incident-title">
            Title
          </label>
          <input
            id="incident-title"
            className="form-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Description</label>
          <textarea
            className="form-control"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Severity</label>
          <select className="form-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Channel</label>
          <select className="form-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {channels.map((c) => (
              <option key={c._id} value={c._id}>
                # {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Create</Button>
      </form>
    </Modal>
  );
}
