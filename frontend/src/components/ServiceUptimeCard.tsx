"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Service, ServiceStatus } from "../stores/serviceStore"
import { getServiceUptimeMetrics } from "@/lib/api"
import { useAuth } from "@clerk/clerk-react"

interface UptimeMetrics {
  uptime24h?: number
  uptime7d?: number
  uptime30d?: number
  avgResponseTime: number
  checks: any[]
  chartData?: Array<{
    time: string
    uptime: number
    responseTime: number
  }>
}

interface ServiceUptimeCardProps {
  service: Service
}

export function ServiceUptimeCard({ service }: ServiceUptimeCardProps) {
  const { getToken } = useAuth()
  const [metrics, setMetrics] = useState<UptimeMetrics>({
    uptime24h: undefined,
    uptime7d: undefined,
    uptime30d: undefined,
    avgResponseTime: 0,
    checks: [],
    chartData: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h")

  // Generate mock chart data based on time range
  const generateChartData = (range: "24h" | "7d" | "30d", uptimeValue: number) => {
    const now = new Date()
    const dataPoints = range === "24h" ? 24 : range === "7d" ? 7 : 30
    const interval = range === "24h" ? "hour" : "day"

    return Array.from({ length: dataPoints }, (_, i) => {
      const time = new Date(now)
      if (interval === "hour") {
        time.setHours(time.getHours() - (dataPoints - 1 - i))
      } else {
        time.setDate(time.getDate() - (dataPoints - 1 - i))
      }

      // Generate realistic uptime data with some variation
      const baseUptime = uptimeValue || 99.5
      const variation = (Math.random() - 0.5) * 2 // ±1% variation
      const uptime = Math.max(95, Math.min(100, baseUptime + variation))

      // Generate response time data
      const baseResponseTime = 150
      const responseTimeVariation = (Math.random() - 0.5) * 100
      const responseTime = Math.max(50, baseResponseTime + responseTimeVariation)

      return {
        time:
          interval === "hour"
            ? time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
            : time.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        uptime: Number(uptime.toFixed(2)),
        responseTime: Math.round(responseTime),
      }
    })
  }

  const fetchMetrics = async () => {
    if (!service.id) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) {
        throw new Error("Please log in to view uptime metrics")
      }

      // Get metrics for all periods in parallel
      const [data24h, data7d, data30d] = await Promise.all([
        getServiceUptimeMetrics(service.id, token, "24h").catch((e) => {
          console.error("Error fetching 24h metrics:", e)
          return { uptime24h: null }
        }),
        getServiceUptimeMetrics(service.id, token, "7d").catch((e) => {
          console.error("Error fetching 7d metrics:", e)
          return { uptime7d: null }
        }),
        getServiceUptimeMetrics(service.id, token, "30d").catch((e) => {
          console.error("Error fetching 30d metrics:", e)
          return { uptime30d: null }
        }),
      ])

      // Transform the response to match the expected format
      const transformedData: UptimeMetrics = {
        uptime24h: data24h?.uptime24h ?? undefined,
        uptime7d: data7d?.uptime7d ?? undefined,
        uptime30d: data30d?.uptime30d ?? undefined,
        avgResponseTime: 0,
        checks: [],
      }

      // Check if we got any valid data
      if (
        transformedData.uptime24h === undefined &&
        transformedData.uptime7d === undefined &&
        transformedData.uptime30d === undefined
      ) {
        throw new Error("Failed to load uptime data. Please try again later.")
      }

      // Generate chart data based on current time range
      const currentUptime =
        timeRange === "24h"
          ? transformedData.uptime24h
          : timeRange === "7d"
            ? transformedData.uptime7d
            : transformedData.uptime30d

      transformedData.chartData = generateChartData(timeRange, currentUptime || 99.5)

      setMetrics(transformedData)
    } catch (err) {
      console.error("Error fetching uptime metrics:", err)
      setError("Failed to load uptime data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [service.id, timeRange])

  // Calculate uptime percentage based on the selected time range
  const getUptimePercentage = (): number => {
    const value = timeRange === "24h" ? metrics.uptime24h : timeRange === "7d" ? metrics.uptime7d : metrics.uptime30d

    if (value === undefined || value === null) {
      return metrics.uptime24h ?? metrics.uptime7d ?? metrics.uptime30d ?? 99.5
    }

    return value
  }

  const uptimePercentage = getUptimePercentage()

  // Map status to color
  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "bg-green-500"
      case "degraded":
        return "bg-yellow-500"
      case "partial_outage":
        return "bg-orange-500"
      case "major_outage":
        return "bg-red-500"
      case "maintenance":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  const getUptimeLabel = () => {
    switch (timeRange) {
      case "24h":
        return "Last 24 hours"
      case "7d":
        return "Last 7 days"
      case "30d":
        return "Last 30 days"
      default:
        return ""
    }
  }

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await fetchMetrics()
  }

  // Render loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Uptime Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <Skeleton className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Uptime Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-destructive">
            <p className="mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="inline-flex items-center">
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If we have no metrics data at all, show a message
  if (metrics.uptime24h === undefined && metrics.uptime7d === undefined && metrics.uptime30d === undefined) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Uptime Metrics</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-2">No uptime data available</p>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="inline-flex items-center">
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <Badge variant="outline" className={`capitalize ${getStatusColor(service.status).replace("bg-", "bg-")}`}>
            {service.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold">{uptimePercentage?.toFixed(2) ?? "99.50"}%</div>
            <p className="text-xs text-muted-foreground">{getUptimeLabel()}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">
              {metrics?.avgResponseTime ? `${Math.round(metrics.avgResponseTime)}ms` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Avg. response</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mb-4 flex items-center justify-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setTimeRange("24h")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timeRange === "24h"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timeRange === "7d"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7d
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timeRange === "30d"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            30d
          </button>
        </div>

        {/* Uptime Chart */}
        <div className="h-32 w-full">
          <ChartContainer
            config={{
              uptime: {
                label: "Uptime %",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.chartData}>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis domain={[95, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={35} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [`${value}%`, name === "uptime" ? "Uptime" : name]}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="uptime"
                  stroke="var(--color-uptime)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, stroke: "var(--color-uptime)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Status Indicator */}
        <div className="mt-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
            <span className="text-muted-foreground capitalize">{service.status.replace(/_/g, " ")}</span>
          </div>
          <span className="text-muted-foreground">
            Updated{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function ServiceUptimeCardSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-2 pb-2">
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-3 w-1/4" />
      </CardContent>
    </Card>
  )
}
