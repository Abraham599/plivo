// Get API URL with fallback
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

// Helper function to create authenticated fetch headers
export const getAuthHeaders = (token?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
});
