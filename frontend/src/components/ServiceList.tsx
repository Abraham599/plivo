import React, { useEffect, useState, useCallback } from 'react';
import { useOrganization } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import {
  getServices,
  createService,
  updateService,
  deleteService,
} from '../api/serviceApi';
import { useWebSocket } from '../hooks/useWebSocket';

interface Service {
  id: string;
  name: string;
  description?: string;
  status: string;
  endpoint?: string;
}

const ServiceList: React.FC = () => {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newService, setNewService] = useState({ name: '', description: '', endpoint: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editService, setEditService] = useState({ name: '', description: '', endpoint: '' });

  // Fetch services
  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    getServices(organization.id)
      .then(setServices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [organization]);

  // Real-time updates
  const handleServiceEvent = useCallback((event: any) => {
    if (!organization) return;
    if (!event.data) return;
    if (event.type === 'service_created') {
      setServices((prev) => {
        // Only add if not already present (avoid duplicates)
        if (prev.some((s) => s.id === event.data.id)) return prev;
        return [...prev, event.data];
      });
    } else if (event.type === 'service_updated') {
      setServices((prev) =>
        prev.map((s) => (s.id === event.data.id ? { ...s, ...event.data } : s))
      );
    } else if (event.type === 'service_deleted') {
      setServices((prev) => prev.filter((s) => s.id !== event.data.id));
    }
  }, [organization]);
  useWebSocket(handleServiceEvent);

  // Add service
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await createService(
        {
          ...newService,
          organization_id: organization.id,
        },
        token || ''
      );
      // setServices((prev) => [...prev, created]); // Now handled by WebSocket
      setNewService({ name: '', description: '', endpoint: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Start editing
  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setEditService({
      name: service.name,
      description: service.description || '',
      endpoint: service.endpoint || '',
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
      await updateService(
        editingId,
        {
          ...editService,
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

  // Delete service
  const handleDelete = async (id: string) => {
    if (!organization) return;
    if (!window.confirm('Delete this service?')) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await deleteService(id, token || '');
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
          placeholder="Name"
          value={newService.name}
          onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={newService.description}
          onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
        />
        <input
          type="text"
          placeholder="Endpoint"
          value={newService.endpoint}
          onChange={(e) => setNewService((s) => ({ ...s, endpoint: e.target.value }))}
        />
        <button type="submit" disabled={loading}>Add Service</button>
      </form>
      <ul>
        {services.map((service) => (
          <li key={service.id} style={{ marginBottom: 8 }}>
            {editingId === service.id ? (
              <form onSubmit={handleEdit} style={{ display: 'inline' }}>
                <input
                  type="text"
                  value={editService.name}
                  onChange={(e) => setEditService((s) => ({ ...s, name: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  value={editService.description}
                  onChange={(e) => setEditService((s) => ({ ...s, description: e.target.value }))}
                />
                <input
                  type="text"
                  value={editService.endpoint}
                  onChange={(e) => setEditService((s) => ({ ...s, endpoint: e.target.value }))}
                />
                <button type="submit" disabled={loading}>Save</button>
                <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <b>{service.name}</b> ({service.status})<br />
                {service.description && <span>{service.description} </span>}
                {service.endpoint && <span>Endpoint: {service.endpoint} </span>}
                <button onClick={() => startEdit(service)} disabled={loading}>Edit</button>
                <button onClick={() => handleDelete(service.id)} disabled={loading}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ServiceList; 