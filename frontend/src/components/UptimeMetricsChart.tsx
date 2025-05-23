"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { useUptimeStore } from "../stores/uptimeStore"

interface UptimeMetricsChartProps {
  serviceId: string
  serviceName: string
}

export function UptimeMetricsChart({ serviceId, serviceName }: UptimeMetricsChartProps) {
  const { metrics, currentUptime, isLoading, fetchUptimeMetrics, fetchCurrentUptime, triggerServiceCheck } =
    useUptimeStore()
  const [period, setPeriod] = useState("daily")
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchUptimeMetrics(serviceId, period, days)
    fetchCurrentUptime(serviceId)
  }, [serviceId, period, days, fetchUptimeMetrics, fetchCurrentUptime])

  const handleRefresh = () => {
    fetchUptimeMetrics(serviceId, period, days)
    fetchCurrentUptime(serviceId)
  }

  const handleTriggerCheck = () => {
    triggerServiceCheck(serviceId)
  }

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), "MMM d")
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="font-medium">{label}</p>
          <p className="text-sm">
            Uptime: <span className="font-medium">{payload[0].value?.toFixed(2)}%</span>
          </p>
          {payload[1]?.value && (
            <p className="text-sm">
              Response Time: <span className="font-medium">{payload[1].value}ms</span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const serviceUptime = currentUptime[serviceId]

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Uptime Metrics - {serviceName}</CardTitle>
        <div className="flex items-center space-x-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days.toString()} onValueChange={(value) => setDays(Number.parseInt(value))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Current Uptime</div>
            <div className="text-2xl font-bold">
              {serviceUptime?.uptime !== null ? `${serviceUptime?.uptime.toFixed(2)}%` : "N/A"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Based on {serviceUptime?.checksCount || 0} checks in the last 24 hours
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Current Status</div>
            <div className="text-2xl font-bold flex items-center">
              {serviceUptime?.currentStatus === "up" ? (
                <>
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  <span>Operational</span>
                </>
              ) : serviceUptime?.currentStatus === "down" ? (
                <>
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  <span>Down</span>
                </>
              ) : (
                "Unknown"
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Last checked:{" "}
              {serviceUptime?.lastCheck ? format(parseISO(serviceUptime.lastCheck), "MMM d, h:mm a") : "Never"}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-between">
            <div className="text-sm text-gray-500">Manual Check</div>
            <Button onClick={handleTriggerCheck} disabled={isLoading} className="mt-2">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Run Check Now
            </Button>
          </div>
        </div>

        <div className="h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : metrics.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">
              No uptime data available. Configure an endpoint URL for this service to start monitoring.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={metrics.map((metric) => ({
                  date: formatDate(metric.startDate),
                  uptime: metric.uptime,
                  responseTime: metric.avgResponseTime,
                  tooltipDate: metric.startDate,
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={["auto", "auto"]}
                  tickFormatter={(value) => `${value}ms`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="uptime"
                  stroke="#4ade80"
                  name="Uptime %"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#60a5fa"
                  name="Response Time (ms)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
