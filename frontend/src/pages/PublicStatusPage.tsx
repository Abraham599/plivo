"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, type TooltipProps } from "recharts"

interface Service {
  id: string
  name: string
  description: string | null
  status: string
  endpoint: string | null
}

interface Update {
  id: string
  message: string
  createdAt: string
}

interface Incident {
  id: string
  title: string
  description: string
  status: string
  services: Service[]
  updates: Update[]
  createdAt: string
  updatedAt: string
}

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

// Get API URL with fallback
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "/api"
}

// Get WebSocket URL with fallback
const getWsUrl = () => {
  return import.meta.env.VITE_WS_URL || "ws://localhost:8000"
}

export default function PublicStatusPage() {
  const [services, setServices] = useState<Service[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [uptimeMetrics, setUptimeMetrics] = useState<Record<string, UptimeMetric[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)

  useEffect(() => {
    const apiUrl = getApiUrl()
    const wsUrl = getWsUrl()

    const fetchData = async () => {
      try {
        // Fetch services
        const servicesResponse = await fetch(`${apiUrl}/services`)
        if (!servicesResponse.ok) {
          throw new Error("Failed to fetch services")
        }
        const servicesData = await servicesResponse.json()
        setServices(servicesData)

        // Fetch incidents
        const incidentsResponse = await fetch(`${apiUrl}/incidents`)
        if (!incidentsResponse.ok) {
          throw new Error("Failed to fetch incidents")
        }
        const incidentsData = await incidentsResponse.json()
        setIncidents(incidentsData)

        // Fetch uptime metrics for services with endpoints
        const metricsPromises = servicesData
          .filter((service: Service) => service.endpoint)
          .map(async (service: Service) => {
            try {
              const metricsResponse = await fetch(`${apiUrl}/services/${service.id}/uptime?period=daily&days=30`)
              if (metricsResponse.ok) {
                const metricsData = await metricsResponse.json()
                return { serviceId: service.id, metrics: metricsData }
              }
              return { serviceId: service.id, metrics: [] }
            } catch (error) {
              console.error(`Error fetching metrics for service ${service.id}:`, error)
              return { serviceId: service.id, metrics: [] }
            }
          })

        const metricsResults = await Promise.all(metricsPromises)
        const metricsMap: Record<string, UptimeMetric[]> = {}
        metricsResults.forEach((result) => {
          metricsMap[result.serviceId] = result.metrics
        })
        setUptimeMetrics(metricsMap)

        setIsLoading(false)
      } catch (error) {
        setError((error as Error).message)
        setIsLoading(false)
      }
    }

    fetchData()

    // Set up WebSocket connection
    try {
      const ws = new WebSocket(`${wsUrl}/ws`)

      ws.onopen = () => {
        console.log("WebSocket connected")
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle different types of WebSocket messages
          switch (data.type) {
            case "service_created":
            case "service_updated":
            case "service_deleted":
              fetchData()
              break
            case "incident_created":
            case "incident_updated":
            case "incident_deleted":
            case "update_created":
              fetchData()
              break
            default:
              console.log("Unknown WebSocket message type:", data.type)
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
      }

      ws.onclose = () => {
        console.log("WebSocket disconnected")
      }

      setWebsocket(ws)

      return () => {
        if (ws) {
          ws.close()
        }
      }
    } catch (error) {
      console.error("Error setting up WebSocket:", error)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-500"
      case "degraded_performance":
        return "bg-yellow-500"
      case "partial_outage":
        return "bg-orange-500"
      case "major_outage":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case "investigating":
        return "bg-yellow-500"
      case "identified":
        return "bg-orange-500"
      case "monitoring":
        return "bg-blue-500"
      case "resolved":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const activeIncidents = incidents.filter((incident) => incident.status !== "resolved")
  const resolvedIncidents = incidents.filter((incident) => incident.status === "resolved").slice(0, 5)

  const allOperational = services.every((service) => service.status === "operational")

  // Services with uptime metrics
  const servicesWithMetrics = services.filter(
    (service) => service.endpoint && uptimeMetrics[service.id] && uptimeMetrics[service.id].length > 0,
  )

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d")
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="font-medium">{label}</p>
          <p className="text-sm">
            Uptime: <span className="font-medium">{payload[0].value?.toFixed(2)}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Status Page</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Current Status</h2>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${allOperational ? "bg-green-500" : "bg-red-500"} mr-2`}></div>
                <span className="text-sm font-medium">
                  {allOperational ? "All Systems Operational" : "System Issues Detected"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="flex justify-between items-center p-4 border rounded-md">
                    <div>
                      <h3 className="font-medium">{service.name}</h3>
                      {service.description && <p className="text-sm text-gray-500">{service.description}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
                      <span className="text-sm font-medium">
                        {service.status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {servicesWithMetrics.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Uptime History (30 days)</h2>
              <div className="space-y-8">
                {servicesWithMetrics.map((service) => (
                  <div key={service.id} className="border-b pb-6 last:border-b-0 last:pb-0">
                    <h3 className="font-medium mb-2">{service.name}</h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={uptimeMetrics[service.id].map((metric) => ({
                            date: formatDate(metric.startDate),
                            uptime: metric.uptime,
                            tooltipDate: metric.startDate,
                          }))}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="uptime"
                            stroke="#4ade80"
                            name="Uptime %"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeIncidents.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Active Incidents</h2>
              <div className="space-y-4">
                {activeIncidents.map((incident) => (
                  <div key={incident.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{incident.title}</h3>
                        <p className="text-sm text-gray-500">{format(new Date(incident.createdAt), "PPP p")}</p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getIncidentStatusColor(incident.status)}`}
                      >
                        {incident.status.replace(/\b\w/g, (l) => l.toUpperCase())}
                      </div>
                    </div>
                    <p className="text-sm mb-2">{incident.description}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {incident.services.map((service) => (
                        <div key={service.id} className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                          {service.name}
                        </div>
                      ))}
                    </div>
                    {incident.updates.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="text-sm font-medium mb-2">Updates</h4>
                        <div className="space-y-2">
                          {incident.updates.map((update) => (
                            <div key={update.id} className="text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{format(new Date(update.createdAt), "PPP p")}</span>
                              </div>
                              <p className="text-gray-700">{update.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolvedIncidents.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Past Incidents</h2>
              <div className="space-y-4">
                {resolvedIncidents.map((incident) => (
                  <div key={incident.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{incident.title}</h3>
                        <p className="text-sm text-gray-500">{format(new Date(incident.createdAt), "PPP p")}</p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getIncidentStatusColor(incident.status)}`}
                      >
                        {incident.status.replace(/\b\w/g, (l) => l.toUpperCase())}
                      </div>
                    </div>
                    <p className="text-sm">{incident.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Status Page. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
