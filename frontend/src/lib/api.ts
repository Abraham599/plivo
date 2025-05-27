// Types
export interface UptimeMetrics {
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  avgResponseTime: number;
  checks: Array<{
    timestamp: string;
    status: 'up' | 'down';
    responseTime: number | null;
  }>;
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
export const getServiceUptimeMetrics = async (serviceId: string, token?: string | null): Promise<UptimeMetrics> => {
  const response = await fetch(
    `${getApiUrl()}/services/${serviceId}/metrics/uptime`,
    {
      headers: getAuthHeaders(token)
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch uptime metrics');
  }
  
  return response.json();
};
