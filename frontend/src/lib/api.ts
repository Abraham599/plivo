// Types
export interface UptimeMetrics {
  uptime24h?: number;
  uptime7d?: number;
  uptime30d?: number;
  avgResponseTime: number;
  checks: any[]; // Not used in the new implementation
}

// Get API URL with fallback
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

// Helper function to create authenticated fetch headers
export const getAuthHeaders = (token?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
});

// Uptime metrics API
export const getServiceUptimeMetrics = async (
  serviceId: string, 
  token?: string | null, 
  period: '24h' | '7d' | '30d' = '7d'
): Promise<UptimeMetrics> => {
  const url = new URL(`${getApiUrl()}/services/${serviceId}/metrics/uptime`);
  url.searchParams.append('period', period);
  
  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(token)
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch uptime metrics');
  }
  
  return response.json();
};
