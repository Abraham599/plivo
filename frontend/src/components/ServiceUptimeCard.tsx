"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useUptimeStore } from "../stores/uptimeStore" // Assuming uptimeStore exists and is correctly defined
import { Loader2 } from "lucide-react"
import type { Service } from "../stores/serviceStore" // Import Service type only

interface ServiceUptimeCardProps {
  // Use a Pick from the main Service type or define explicitly matching relevant fields
  service: Pick<Service, "id" | "name" | "status" | "url">;
}

export function ServiceUptimeCard({ service }: ServiceUptimeCardProps) {
  // Assuming useUptimeStore provides isLoading as a boolean or an object keyed by service.id
  // And currentUptime as an object keyed by service.id
  const { currentUptime, isLoading, fetchCurrentUptime } = useUptimeStore(
    // Example if zustand selector is used:
    // state => ({
    //   currentUptime: state.currentUptime,
    //   isLoading: state.isLoading[service.id] ?? state.globalIsLoading, // Adapt as per your store structure
    //   fetchCurrentUptime: state.fetchCurrentUptime
    // })
  );


  useEffect(() => {
    if (service.url) {
      fetchCurrentUptime(service.id);
    }
  }, [service.id, service.url, fetchCurrentUptime]);

  if (!service.url) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gray-50 dark:bg-gray-800 pb-2">
          <CardTitle className="text-sm font-medium">{service.name} Uptime</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
            Monitoring URL not configured.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Adapt this based on how isLoading is structured in useUptimeStore
  const isServiceLoading = typeof isLoading === 'object' ? isLoading[service.id] : isLoading;
  const serviceUptimeData = currentUptime[service.id];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gray-50 dark:bg-gray-800 pb-2">
        <CardTitle className="text-sm font-medium">{service.name} Uptime</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isServiceLoading ? (
          <div className="flex justify-center items-center h-16">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : !serviceUptimeData ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">No uptime data available</div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Uptime (24h):</span>
              <span className="font-medium">
                {serviceUptimeData.uptime !== null && serviceUptimeData.uptime !== undefined
                  ? `${serviceUptimeData.uptime.toFixed(2)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  serviceUptimeData.currentStatus === "up" ? "bg-green-500" : "bg-red-500"
                }`}
                style={{ width: `${serviceUptimeData.uptime ?? 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
              <span>Status: {serviceUptimeData.currentStatus === "up" ? "Operational" : (serviceUptimeData.currentStatus === "down" ? "Down" : "Unknown")}</span>
              <span>{serviceUptimeData.checksCount} checks</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}