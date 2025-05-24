import React, { useEffect, useState, useCallback } from 'react';
import { useOrganization } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import {
  getIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  addIncidentUpdate,
} from '../api/incidentApi';
import { getServices } from '../api/serviceApi';
import { useWebSocket } from '../hooks/useWebSocket';

interface Incident {
  id: string;
  title: string;
  description: string;
  status: string;
  services: { id: string; name: string }[];
  updates?: { id: string; message: string }[];
}

interface Service {
  id: string;
  name: string;
}

const IncidentList: React.FC = () => {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    status: 'operational',
    service_ids: [] as string[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIncident, setEditIncident] = useState({
    title: '',
    description: '',
    status: 'operational',
    service_ids: [] as string[],
  });
  const [updateMessage, setUpdateMessage] = useState<{ [incidentId: string]: string }>({});

  // Fetch incidents and services
  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    Promise.all([
      getIncidents(organization.id),
      getServices(organization.id),
    ])
      .then(([incidents, services]) => {
        setIncidents(incidents);
        setServices(services);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [organization]);

  // Real-time updates
  const handleIncidentEvent = useCallback((event: any) => {
    if (!organization) return;
    if (!event.data) return;
    if (event.type === 'incident_created') {
      setIncidents((prev) => {
        if (prev.some((i) => i.id === event.data.id)) return prev;
        return [...prev, event.data];
      });
    } else if (event.type === 'incident_updated') {
      setIncidents((prev) =>
        prev.map((i) => (i.id === event.data.id ? { ...i, ...event.data } : i))
      );
    } else if (event.type === 'incident_deleted') {
      setIncidents((prev) => prev.filter((i) => i.id !== event.data.id));
    } else if (event.type === 'update_created') {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === event.data.incident_id
            ? {
                ...i,
                updates: i.updates
                  ? [...i.updates, { id: event.data.id, message: event.data.message }]
                  : [{ id: event.data.id, message: event.data.message }],
              }
            : i
        )
      );
    }
  }, [organization]);
  useWebSocket(handleIncidentEvent);

  // Add incident
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await createIncident(
        {
          ...newIncident,
          organization_id: organization.id,
        },
        token || ''
      );
      // setIncidents((prev) => [...prev, created]); // Now handled by WebSocket
      setNewIncident({ title: '', description: '', status: 'operational', service_ids: [] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Start editing
  const startEdit = (incident: Incident) => {
    setEditingId(incident.id);
    setEditIncident({
      title: incident.title,
      description: incident.description,
      status: incident.status,
      service_ids: incident.services.map((s) => s.id),
    });
  };

  // Save edit
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !editingId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await updateIncident(
        editingId,
        {
          ...editIncident,
        },
        token || ''
      );
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete incident
  const handleDelete = async (id: string) => {
    if (!organization) return;
    if (!window.confirm('Delete this incident?')) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await deleteIncident(id, token || '');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Add update to incident
  const handleAddUpdate = async (incidentId: string) => {
    if (!organization) return;
    const message = updateMessage[incidentId];
    if (!message) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await addIncidentUpdate({ message, incident_id: incidentId }, token || '');
      setUpdateMessage((prev) => ({ ...prev, [incidentId]: '' }));
      // Now handled by WebSocket
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {loading && <div>Loading...</div>}
      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Title"
          value={newIncident.title}
          onChange={(e) => setNewIncident((i) => ({ ...i, title: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={newIncident.description}
          onChange={(e) => setNewIncident((i) => ({ ...i, description: e.target.value }))}
        />
        <select
          value={newIncident.status}
          onChange={(e) => setNewIncident((i) => ({ ...i, status: e.target.value }))}
        >
          <option value="operational">Operational</option>
          <option value="degraded">Degraded Performance</option>
          <option value="partial_outage">Partial Outage</option>
          <option value="major_outage">Major Outage</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          multiple
          value={newIncident.service_ids}
          onChange={(e) => {
            const options = Array.from(e.target.selectedOptions).map((o) => o.value);
            setNewIncident((i) => ({ ...i, service_ids: options }));
          }}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" disabled={loading}>Add Incident</button>
      </form>
      <ul>
        {incidents.map((incident) => (
          <li key={incident.id} style={{ marginBottom: 16 }}>
            {editingId === incident.id ? (
              <form onSubmit={handleEdit} style={{ display: 'inline' }}>
                <input
                  type="text"
                  value={editIncident.title}
                  onChange={(e) => setEditIncident((i) => ({ ...i, title: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  value={editIncident.description}
                  onChange={(e) => setEditIncident((i) => ({ ...i, description: e.target.value }))}
                />
                <select
                  value={editIncident.status}
                  onChange={(e) => setEditIncident((i) => ({ ...i, status: e.target.value }))}
                >
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded Performance</option>
                  <option value="partial_outage">Partial Outage</option>
                  <option value="major_outage">Major Outage</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  multiple
                  value={editIncident.service_ids}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setEditIncident((i) => ({ ...i, service_ids: options }));
                  }}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="submit" disabled={loading}>Save</button>
                <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <b>{incident.title}</b> ({incident.status})<br />
                {incident.description && <span>{incident.description} </span>}<br />
                Services: {incident.services.map((s) => s.name).join(', ')}<br />
                <button onClick={() => startEdit(incident)} disabled={loading}>Edit</button>
                <button onClick={() => handleDelete(incident.id)} disabled={loading}>Delete</button>
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Add update"
                    value={updateMessage[incident.id] || ''}
                    onChange={(e) => setUpdateMessage((prev) => ({ ...prev, [incident.id]: e.target.value }))}
                  />
                  <button onClick={() => handleAddUpdate(incident.id)} disabled={loading}>Add Update</button>
                </div>
                {/* Show updates if present */}
                {incident.updates && incident.updates.length > 0 && (
                  <ul>
                    {incident.updates.map((u) => (
                      <li key={u.id}>{u.message}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default IncidentList; 