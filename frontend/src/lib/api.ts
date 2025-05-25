// Get API URL with fallback
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

// This function should be called from within a component that has access to Clerk's hooks
export const getToken = async (): Promise<string | null> => {
  try {
    // This is a fallback that should be replaced with the actual token from the component
    // that's using Clerk's useAuth hook
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Helper function to create authenticated fetch options
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};
