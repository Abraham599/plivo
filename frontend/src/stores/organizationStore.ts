import { create } from "zustand";
import { getUserOrganizations, createOrganization, switchOrganization, type Organization } from "../api/userApi";

interface OrganizationStore {
  // Current active organization
  currentOrganization: Organization | null;
  // All organizations the user is a member of
  organizations: Organization[];
  isLoading: boolean;
  error: string | null;
  
  // Fetch all organizations the user is a member of
  fetchOrganizations: (token: string) => Promise<Organization[]>;
  // Set the current active organization
  setCurrentOrganization: (org: Organization) => void;
  // Create a new organization
  createNewOrganization: (name: string, token: string) => Promise<Organization>;
  // Switch to a different organization
  switchToOrganization: (organizationId: string, token: string) => Promise<void>;
}

// API URL is handled in the API functions

export const useOrganizationStore = create<OrganizationStore>((set, get) => ({
  currentOrganization: null,
  organizations: [],
  isLoading: false,
  error: null,

  fetchOrganizations: async (token: string) => {
    console.log('[OrganizationStore] fetchOrganizations: Starting fetch with token', { hasToken: !!token });
    set({ isLoading: true, error: null });
    try {
      // First ensure user is synced to get the current organization
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      console.log('[OrganizationStore] fetchOrganizations: Making sync request to:', `${API_URL}/users/ensure-synced`);
      const syncResponse = await fetch(`${API_URL}/users/ensure-synced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });
      
      console.log('[OrganizationStore] fetchOrganizations: Sync response status:', syncResponse.status);
      if (!syncResponse.ok) {
        const errorText = await syncResponse.text().catch(() => 'No response body');
        console.error('[OrganizationStore] fetchOrganizations: Sync response error:', errorText);
        throw new Error(`Failed to sync user: ${syncResponse.status} ${errorText}`);
      }
      const syncData = await syncResponse.json();
      console.log('[OrganizationStore] fetchOrganizations: Sync data received:', syncData);

      // Then fetch organizations
      console.log('[OrganizationStore] fetchOrganizations: Fetching organizations from API');
      const organizations = await getUserOrganizations(token).catch(error => {
        console.error('[OrganizationStore] fetchOrganizations: Error fetching organizations:', error);
        throw error;
      });
      console.log('[OrganizationStore] fetchOrganizations: Organizations fetched:', organizations);
      
      // Find the current organization from the sync response
      console.log('[OrganizationStore] fetchOrganizations: Looking for organization with ID:', syncData.organization_id);
      
      // WORKAROUND: If organizations array is empty but we have an organization_id from sync,
      // create a temporary organization object to allow the app to function
      let currentOrg = null;
      if (organizations.length === 0 && syncData.organization_id) {
        console.log('[OrganizationStore] WORKAROUND: Creating temporary organization from sync data');
        currentOrg = {
          id: syncData.organization_id,
          name: 'Your Organization',  // Default name
          clerk_org_id: syncData.clerk_org_id, // Using the same ID
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clerk_details: {
            name: 'Your Organization',
            slug: '',
            created_at: new Date().toISOString(),
            role: 'admin'
          }
        };
        // Add this to the organizations array too
        organizations.push(currentOrg);
      } else {
        currentOrg = organizations.find(org => org.id === syncData.organization_id) || null;
      }
      
      console.log('[OrganizationStore] fetchOrganizations: Setting current organization:', currentOrg);
      
      set({ 
        organizations,
        currentOrganization: currentOrg,
        isLoading: false,
        error: null
      });
      console.log('[OrganizationStore] fetchOrganizations: Store updated with', {
        organizationsCount: organizations.length,
        hasCurrentOrg: !!currentOrg,
        currentOrgId: currentOrg?.id
      });
      
      return organizations;
    } catch (error) {
      console.error('Error fetching organizations:', error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
        organizations: [],
        currentOrganization: null
      });
      return [];
    }
  },

  setCurrentOrganization: (organization) => {
    set({ currentOrganization: organization });
  },
  
  createNewOrganization: async (name: string, token: string) => {
    set({ isLoading: true, error: null });
    try {
      const newOrg = await createOrganization(name, token);
      set(state => ({ 
        organizations: [...state.organizations, newOrg],
        currentOrganization: newOrg,
        isLoading: false 
      }));
      return newOrg;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
      throw error;
    }
  },
  
  switchToOrganization: async (organizationId: string, token: string) => {
    set({ isLoading: true, error: null });
    try {
      // Call the backend to switch organizations
      await switchOrganization(organizationId, token);
      
      // Find the organization in our local state
      const org = get().organizations.find((o: Organization) => o.id === organizationId);
      if (org) {
        set({ currentOrganization: org, isLoading: false });
      } else {
        throw new Error("Organization not found in local state");
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
      throw error;
    }
  },
}))
