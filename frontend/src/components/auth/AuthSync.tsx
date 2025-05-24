import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL;

const AuthSyncer: React.FC = () => {
  const { isSignedIn, getToken, isLoaded: isAuthLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  // Use a ref or state to track if sync has been attempted for the current user session
  const [hasSyncedForCurrentUser, setHasSyncedForCurrentUser] = useState(false);

  useEffect(() => {
    // Ensure auth and user data are loaded, user is signed in, and we haven't synced this user yet
    if (isAuthLoaded && isUserLoaded && isSignedIn && user && !hasSyncedForCurrentUser) {
      const syncUser = async () => {
        console.log('AuthSyncer: Attempting to sync user:', user.id);
        try {
          const token = await getToken();
          if (!token) {
            console.error("AuthSyncer: No token available for sync.");
            return;
          }

          const response = await fetch(`${API_URL}/users/ensure-synced`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            console.log("AuthSyncer: User synced successfully with backend.");
            setHasSyncedForCurrentUser(true); // Mark as synced
          } else {
            const errorData = await response.json().catch(() => ({ detail: "AuthSyncer: Failed to parse error from sync endpoint." }));
            console.error('AuthSyncer: Failed to sync user with backend:', response.status, errorData.detail);
            // Optionally, you could try again or notify the user
          }
        } catch (error) {
          console.error('AuthSyncer: Error during user sync API call:', error);
        }
      };

      syncUser();
    } else if (isAuthLoaded && !isSignedIn) {
      // Reset sync status if user signs out, so sync can happen for next login
      if (hasSyncedForCurrentUser) {
        setHasSyncedForCurrentUser(false);
      }
    }
  }, [isSignedIn, user, getToken, isAuthLoaded, isUserLoaded, hasSyncedForCurrentUser]);

  return null; // This component does not render anything visible
};

export default AuthSyncer;