const API_URL = import.meta.env.VITE_API_URL;

export async function getServices(organizationId: string) {
  const res = await fetch(`${API_URL}/services?organization_id=${organizationId}`);
  if (!res.ok) throw new Error('Failed to fetch services');
  return res.json();
}

export async function createService(data: {
  name: string;
  description?: string;
  endpoint?: string;
  organization_id: string;
}, token: string) {
  const res = await fetch(`${API_URL}/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create service');
  return res.json();
}

export async function updateService(serviceId: string, data: any, token: string) {
  const res = await fetch(`${API_URL}/services/${serviceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update service');
  return res.json();
}

export async function deleteService(serviceId: string, token: string) {
  const res = await fetch(`${API_URL}/services/${serviceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to delete service');
  return res.json();
} 