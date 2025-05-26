import { create } from "zustand";

// Define and export ServiceStatus type
export type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";

export interface Service {
  id: string;
  name: string;
  description?: string;
  status: ServiceStatus;
  url?: string;
  endpoint?: string;
  organizationId: string;
  organization_id?: string; // Add this to match backend response
  createdAt: string;
  updatedAt: string;
}

interface ServiceStore {
  services: Service[];
  isLoading: boolean;
  error: string | null;
  fetchServices: (token: string) => Promise<void>;
  createService: (service: Omit<Service, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateService: (id: string, updates: Partial<Omit<Service, "id" | "createdAt" | "updatedAt" | "organizationId">>) => Promise<void>; // Make updates more specific if needed
  deleteService: (id: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

import { useOrganizationStore } from "./organizationStore";

export const useServiceStore = create<ServiceStore>((set) => ({
  services: [],
  isLoading: false,
  error: null,

  fetchServices: async (token: string) => {
    console.log('[ServiceStore] fetchServices: Initiated.', { hasToken: !!token });
    console.log("fetchServices called with token:", token ? 'Token Present' : 'Token Missing/Empty');
    set({ isLoading: true, error: null });
    try {
      console.log('[ServiceStore] fetchServices: Current state before fetch attempt:', JSON.stringify(useServiceStore.getState()));
      if (!token) {
        console.error('[ServiceStore] fetchServices: Authentication token is missing or empty inside fetchServices.');
        throw new Error("No authentication token available");
      }

      // Get the organization ID from the organizationStore
      const organizationId = useOrganizationStore.getState().currentOrganization?.id;
      console.log('[ServiceStore] fetchServices: Organization ID from organizationStore:', organizationId);
      if (!organizationId) {
        console.warn("[ServiceStore] fetchServices: No organization selected or available in organizationStore. Aborting fetch.");
        set({ services: [], isLoading: false, error: "No organization selected. Please select or create an organization first." });
        return;
      }
      const fetchUrl = `${API_URL}/services?organization_id=${organizationId}`;
      console.log('[ServiceStore] fetchServices: Attempting to fetch from URL:', fetchUrl);
      const response = await fetch(fetchUrl, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      console.log('[ServiceStore] fetchServices: Response received. Status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to fetch services" }));
        console.error('[ServiceStore] fetchServices: API response not OK.', { status: response.status, errorData });
        throw new Error(errorData.detail || "Failed to fetch services");
      }

      const services = await response.json();
      console.log('[ServiceStore] fetchServices: Services data received from API:', services);
      
      // If backend returns null/undefined, use an empty array to prevent errors
      const safeServices = Array.isArray(services) ? services : [];
      console.log('[ServiceStore] fetchServices: Safe services (after null check):', safeServices);
      
      set({ services: safeServices, isLoading: false });
      console.log('[ServiceStore] fetchServices: Store updated. Number of services:', safeServices.length);
    } catch (error) {
      console.error('[ServiceStore] fetchServices: Error caught during fetch process:', error);
      // Set empty services array to prevent UI from waiting forever
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
        services: [] // Always set services to an empty array on error to prevent UI from hanging
      });
    }
  },

  createService: async (serviceData) => {
    set({ isLoading: true, error: null });
    try {
      // Get the token from Clerk
      const token = await window.Clerk.session?.getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      // Get the current organization from the sync response
      const syncResponse = await fetch(`${API_URL}/users/ensure-synced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!syncResponse.ok) {
        throw new Error('Failed to sync user');
      }
      const syncData = await syncResponse.json();

      const response = await fetch(`${API_URL}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: serviceData.name,
          description: serviceData.description,
          status: serviceData.status || 'operational',
          endpoint: serviceData.url, // Map url to endpoint as expected by backend
          organization_id: syncData.organization_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `Failed to create service: ${response.status}`);
      }

      const newService = await response.json();
      
      // Update the store with the new service
      set((state) => ({
        services: [...state.services, newService],
        isLoading: false,
        error: null
      }));

      return newService;
    } catch (error) {
      console.error("Service creation failed:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to create service",
        isLoading: false
      });
      throw error;
    }
  },

  updateService: async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/api/services/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: "Failed to update service" }));
        throw new Error(errorBody.message || "Failed to update service");
      }

      const updatedService = await response.json();
      set((state) => ({
        services: state.services.map((service) => (service.id === id ? updatedService : service)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error; // Re-throw to be caught by caller if needed
    }
  },

  deleteService: async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/services/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: "Failed to delete service" }));
        throw new Error(errorBody.message || "Failed to delete service");
      }

      set((state) => ({
        services: state.services.filter((service) => service.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error; // Re-throw to be caught by caller if needed
    }
  },
}));