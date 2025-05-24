"use client"

import { create } from "zustand"
import { useOrganizationStore } from "@/stores/organizationStore"

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface Update {
  id: string
  message: string
  incident_id: string
  createdAt: string
}

export interface Incident {
  id: string
  title: string
  description: string
  status: IncidentStatus
  services: { id: string; name: string; status: string }[] // Consider if service.status here should also be typed ServiceStatus
  updates: Update[]
  organization_id: string
  createdAt: string
  updatedAt: string
}

// Define the GetToken type to match Clerk's getToken function
// You might need to import GetTokenOptions from @clerk/types if you use options
type GetTokenFunction = (options?: any) => Promise<string | null>;


interface IncidentState {
  incidents: Incident[]
  isLoading: boolean
  error: string | null
  fetchIncidents: (getToken: GetTokenFunction, status?: IncidentStatus) => Promise<void>;
  createIncident: (
    getToken: GetTokenFunction,
    title: string,
    description: string,
    status: IncidentStatus,
    service_ids: string[]
  ) => Promise<void>;
  updateIncident: (
    getToken: GetTokenFunction,
    id: string,
    data: Partial<Omit<Incident, "services" | "updates" | "status"> & { status?: IncidentStatus; service_ids?: string[] }>
  ) => Promise<void>;
  deleteIncident: (getToken: GetTokenFunction, id: string) => Promise<void>;
  addUpdate: (getToken: GetTokenFunction, incident_id: string, message: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const useIncidentStore = create<IncidentState>((set) => ({
  incidents: [],
  isLoading: false,
  error: null,

  fetchIncidents: async (getToken, status?: IncidentStatus) => {
    const { currentOrganization } = useOrganizationStore.getState();

    if (!currentOrganization) {
      set({ error: "No organization selected", isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available. Please sign in.");
      }
      let url = `${API_URL}/incidents?organization_id=${currentOrganization.id}`;
      if (status) {
        url += `&status=${status}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch incidents" }));
        throw new Error(errorData.message || "Failed to fetch incidents");
      }
      const data = await response.json();
      set({ incidents: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      // throw error; // Optionally re-throw
    }
  },

  createIncident: async (getToken, title, description, status, service_ids) => {
    const { currentOrganization } = useOrganizationStore.getState();
    if (!currentOrganization) {
      set({ error: "No organization selected", isLoading: false });
      throw new Error("No organization selected");
    }
    set({ isLoading: true, error: null });
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available. Please sign in.");
      const response = await fetch(`${API_URL}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, description, status, service_ids, organization_id: currentOrganization.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to create incident" }));
        throw new Error(errorData.message || "Failed to create incident");
      }
      const newIncident = await response.json();
      set((state) => ({ incidents: [...state.incidents, newIncident], isLoading: false }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateIncident: async (getToken, id, data) => {
    set({ isLoading: true, error: null });
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available. Please sign in.");
      const response = await fetch(`${API_URL}/incidents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update incident" }));
        throw new Error(errorData.message || "Failed to update incident");
      }
      const updatedIncident = await response.json();
      set((state) => ({
        incidents: state.incidents.map((inc) => (inc.id === id ? { ...inc, ...updatedIncident } : inc)),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  deleteIncident: async (getToken, id) => {
    set({ isLoading: true, error: null });
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available. Please sign in.");
       const response = await fetch(`${API_URL}/incidents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete incident" }));
        throw new Error(errorData.message || "Failed to delete incident");
      }
      set((state) => ({
        incidents: state.incidents.filter((incident) => incident.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  addUpdate: async (getToken, incident_id, message) => {
    set({ isLoading: true, error: null });
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available. Please sign in.");
      const response = await fetch(`${API_URL}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ incident_id, message }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to add update" }));
        throw new Error(errorData.message || "Failed to add update");
      }
      const newUpdate = await response.json();
      set((state) => ({
        incidents: state.incidents.map((incident) =>
          incident.id === incident_id
            ? { ...incident, updates: incident.updates ? [...incident.updates, newUpdate] : [newUpdate] }
            : incident
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
}));