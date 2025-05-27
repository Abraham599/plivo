"use client"

import { create } from "zustand"
import { useAuth } from "@clerk/clerk-react"

interface UptimeMetric {
  id: string
  service_id: string
  period: string
  startDate: string
  endDate: string
  uptime: number
  avgResponseTime: number | null
  checksCount: number
  downtimeMinutes: number
}

export interface CurrentUptime {
  uptime: number | null
  checksCount: number
  lastCheck: string | null
  currentStatus: string | null
}

interface UptimeState {
  metrics: UptimeMetric[]
  currentUptime: Record<string, CurrentUptime>
  isLoading: boolean
  error: string | null
  fetchUptimeMetrics: (serviceId: string, period?: string, days?: number) => Promise<void>
  fetchCurrentUptime: (serviceId: string) => Promise<void>
  triggerServiceCheck: (serviceId: string) => Promise<void>
}

export const useUptimeStore = create<UptimeState>((set, get) => ({
  metrics: [],
  currentUptime: {},
  isLoading: false,
  error: null,

  fetchUptimeMetrics: async (serviceId: string, period = "daily", days = 30) => {
    const { getToken } = useAuth()

    set({ isLoading: true, error: null })

    try {
      const token = await getToken()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/services/${serviceId}/uptime?period=${period}&days=${days}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to fetch uptime metrics")
      }

      const data = await response.json()
      set({ metrics: data, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  fetchCurrentUptime: async (serviceId: string) => {
    const { getToken } = useAuth()

    set({ isLoading: true, error: null })

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/services/${serviceId}/uptime/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch current uptime")
      }

      const data = await response.json()
      set({
        currentUptime: {
          ...get().currentUptime,
          [serviceId]: data,
        },
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  triggerServiceCheck: async (serviceId: string) => {
    const { getToken } = useAuth()

    set({ isLoading: true, error: null })

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/services/${serviceId}/check`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to trigger service check")
      }

      // Refresh current uptime after a short delay to allow the check to complete
      setTimeout(() => {
        get().fetchCurrentUptime(serviceId)
      }, 3000)

      set({ isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },
}))
