import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import * as incidentApi from '../api/incidentApi';
import { useSocket } from '../hooks/useSocket';
import IncidentHeader from '../components/incidents/IncidentHeader';
import IncidentTimeline from '../components/incidents/IncidentTimeline';
import IncidentActions from '../components/incidents/IncidentActions';

const INCIDENT_SOCKET_EVENTS = ['incident:updated', 'incident:acknowledged', 'incident:resolved'];

export default function IncidentDetails() {
  const { incidentId } = useParams();
  const { team, pushToast } = useOutletContext();
  const socket = useSocket();
  const [incident, setIncident] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    incidentApi.getIncident(incidentId).then((res) => {
      if (!cancelled) setIncident(res.data.data.incident);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  useEffect(() => {
    let cancelled = false;
    incidentApi.getIncidentHistory(incidentId).then((res) => {
      if (!cancelled) setEvents(res.data.data.events);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  const channelId = incident?.channel?._id;

  useEffect(() => {
    if (!socket || !channelId) return undefined;

    function joinChannel() {
      socket.emit('channel:join', channelId);
    }
    function handleIncidentEvent(payload) {
      if (payload._id !== incidentId) return;
      setIncident(payload);
      incidentApi.getIncidentHistory(incidentId).then((res) => setEvents(res.data.data.events));
    }

    joinChannel();
    socket.on('connect', joinChannel);
    INCIDENT_SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, handleIncidentEvent));

    return () => {
      socket.off('connect', joinChannel);
      INCIDENT_SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, handleIncidentEvent));
      socket.emit('channel:leave', channelId);
    };
  }, [socket, incidentId, channelId]);

  if (!incident || !team) return null;

  return (
    <div className="p-4">
      <IncidentHeader incident={incident} />
      <IncidentActions incident={incident} members={team.members ?? []} pushToast={pushToast} />
      <hr className="my-4" />
      <IncidentTimeline events={events} />
    </div>
  );
}
