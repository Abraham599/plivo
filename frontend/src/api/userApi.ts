const API_URL = import.meta.env.VITE_API_URL;

export async function ensureUserInBackend({ email, name, organization_id }: { email: string; name?: string; organization_id: string }, token: string) {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ email, name, organization_id }),
  });
  if (!res.ok) throw new Error('Failed to sync user');
  return res.json();
} 