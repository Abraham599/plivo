"use client"

import { create } from "zustand"

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved" | "scheduled";

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
  scheduledFor?: string  // Optional scheduled date for future incidents
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
    console.log('[IncidentStore] fetchIncidents: Starting fetch');
    set({ isLoading: true, error: null });
    try {
      console.log('[IncidentStore] fetchIncidents: Getting token');
      const token = await getToken();
      console.log('[IncidentStore] fetchIncidents: Token received:', !!token);
      if (!token) {
        throw new Error("Authentication token not available. Please sign in.");
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

      let url = `${API_URL}/incidents?organization_id=${syncData.organization_id}`;
      if (status) {
        url += `&status=${status}`;
      }
      console.log('[IncidentStore] fetchIncidents: Fetching from URL:', url);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[IncidentStore] fetchIncidents: Response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch incidents" }));
        console.error('[IncidentStore] fetchIncidents: API response error:', { status: response.status, errorData });
        throw new Error(errorData.message || "Failed to fetch incidents");
      }
      const data = await response.json();
      console.log('[IncidentStore] fetchIncidents: Data received:', data);
      
      // If backend returns null/undefined, use an empty array to prevent errors
      const safeData = Array.isArray(data) ? data : [];
      console.log('[IncidentStore] fetchIncidents: Safe data (after null check):', safeData);
      
      set({ incidents: safeData, isLoading: false });
      console.log('[IncidentStore] fetchIncidents: Store updated with incidents count:', safeData.length);
    } catch (error) {
      console.error('[IncidentStore] fetchIncidents: Error caught:', error);
      // Set empty incidents array to prevent UI from waiting forever
      set({ 
        error: (error as Error).message, 
        isLoading: false,
        incidents: []
      });
      // Don't re-throw - let the UI continue with empty state
    }
    console.log('[IncidentStore] fetchIncidents: Fetch completed');
  },

  createIncident: async (getToken, title, description, status, service_ids) => {
    set({ isLoading: true, error: null });
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available. Please sign in.");

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
      const response = await fetch(`${API_URL}/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          status,
          service_ids,
          organization_id: syncData.organization_id,
        }),
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