import { create } from "zustand";

// Define and export ServiceStatus type
export type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";

export interface Service {
  id: string;
  name: string;
  description?: string;
  status: ServiceStatus; // Use the exported ServiceStatus type
  url?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

interface ServiceStore {
  services: Service[];
  isLoading: boolean;
  error: string | null;
  fetchServices: () => Promise<void>;
  createService: (service: Omit<Service, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateService: (id: string, updates: Partial<Omit<Service, "id" | "createdAt" | "updatedAt" | "organizationId">>) => Promise<void>; // Make updates more specific if needed
  deleteService: (id: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const useServiceStore = create<ServiceStore>((set, get) => ({
  services: [],
  isLoading: false,
  error: null,

  fetchServices: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/services`, {
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch services");
      }

      const services = await response.json();
      set({ services, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  createService: async (serviceData) => {
    try {
      const response = await fetch(`${API_URL}/api/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(serviceData),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: "Failed to create service" }));
        throw new Error(errorBody.message || "Failed to create service");
      }

      const newService = await response.json();
      set((state) => ({
        services: [...state.services, newService],
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error; // Re-throw to be caught by caller if needed
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