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
    set({ isLoading: true, error: null });
    try {
      const organizations = await getUserOrganizations(token);
      set({ 
        organizations, 
        isLoading: false,
        // Set the first organization as current if there's no current organization
        currentOrganization: get().currentOrganization || (organizations.length > 0 ? organizations[0] : null)
      });
      return organizations;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
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
