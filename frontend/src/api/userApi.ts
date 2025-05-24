const API_URL = import.meta.env.VITE_API_URL;

export interface SyncedUserResponse {
  id: string;
  clerk_user_id: string;
  email: string;
  name?: string;
  organization_id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  clerk_org_id: string;
  createdAt: string;
  updatedAt: string;
  clerk_details?: {
    name: string;
    slug?: string;
    created_at: string;
    role: string;
  };
}

// Ensure user is synced with the backend
export async function ensureUserSynced(token: string): Promise<SyncedUserResponse> {
  const res = await fetch(`${API_URL}/users/ensure-synced`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to sync user');
  }
  
  return res.json();
}

// Legacy function - kept for backward compatibility
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

// Get all organizations the user is a member of
export async function getUserOrganizations(token: string): Promise<Organization[]> {
  const res = await fetch(`${API_URL}/organizations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to get organizations');
  }
  
  return res.json();
}

// Create a new organization
export async function createOrganization(name: string, token: string): Promise<Organization> {
  const res = await fetch(`${API_URL}/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create organization');
  }
  
  return res.json();
}

// Switch to a different organization
export async function switchOrganization(organizationId: string, token: string) {
  const res = await fetch(`${API_URL}/organizations/switch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ organization_id: organizationId }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to switch organization');
  }
  
  return res.json();
}