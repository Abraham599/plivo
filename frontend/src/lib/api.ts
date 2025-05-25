// Get API URL with fallback
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

// Get auth token from local storage
export const getToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('token');
  return token;
};
