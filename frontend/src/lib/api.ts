// Get API URL with fallback
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

// Get auth token from Clerk
export const getToken = async (): Promise<string | null> => {
  try {
    // Get the token from Clerk's session
    const { useAuth } = await import('@clerk/clerk-react');
    const { getToken } = useAuth();
    return await getToken();
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};
