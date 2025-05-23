import { create } from "zustand"

interface Organization {
  id: string
  name: string
  slug: string
}

interface OrganizationStore {
  organization: Organization | null
  isLoading: boolean
  error: string | null
  fetchOrganization: () => Promise<void>
  setOrganization: (org: Organization) => void
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export const useOrganizationStore = create<OrganizationStore>((set, get) => ({
  organization: null,
  isLoading: false,
  error: null,

  fetchOrganization: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_URL}/api/organization`, {
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch organization")
      }

      const organization = await response.json()
      set({ organization, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      })
    }
  },

  setOrganization: (organization) => {
    set({ organization })
  },
}))
