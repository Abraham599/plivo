// Types
export interface UptimeMetrics {
  uptime24h?: number | null;
  uptime7d?: number | null;
  uptime30d?: number | null;
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
  if (!token) {
    throw new Error('Authentication token is required');
  }

  const url = new URL(`${getApiUrl()}/services/${serviceId}/metrics/uptime`);
  url.searchParams.append('period', period);
  
  try {
    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(token),
      credentials: 'include'  // Include cookies for authentication
    });
    
    if (response.status === 401) {
      throw new Error('Unauthorized - Please log in again');
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to fetch uptime metrics');
    }
    
    const data = await response.json();
    
    // Ensure the response has the expected structure
    const uptimeKey = `uptime${period}` as keyof typeof data;
    if (data[uptimeKey] === undefined) {
      console.warn('Unexpected response format from uptime metrics API:', data);
      // Return default values if the response format is unexpected
      return {
        [uptimeKey]: 100,
        avgResponseTime: 0,
        checks: []
      } as unknown as UptimeMetrics;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching uptime metrics:', error);
    throw error; // Re-throw to be handled by the component
  }
};
