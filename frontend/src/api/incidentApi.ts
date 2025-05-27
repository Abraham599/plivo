const API_URL = import.meta.env.VITE_API_URL;

export async function getIncidents(organizationId: string) {
  const res = await fetch(`${API_URL}/incidents?organization_id=${organizationId}`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function createIncident(data: {
  title: string;
  description: string;
  status: string;
  service_ids: string[];
  organization_id: string;
}, token: string) {
  const res = await fetch(`${API_URL}/incidents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create incident');
  return res.json();
}

export async function updateIncident(incidentId: string, data: any, token: string) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update incident');
  return res.json();
}

export async function deleteIncident(incidentId: string, token: string) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to delete incident');
  return res.json();
}

export async function addIncidentUpdate(data: { message: string; incident_id: string }, token: string) {
  const res = await fetch(`${API_URL}/incidents/${data.incident_id}/updates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message: data.message }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to add update');
  }
  return res.json();
}