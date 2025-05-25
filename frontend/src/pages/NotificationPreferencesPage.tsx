"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function NotificationPreferencesPage() {
  const { getToken } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [preferences, setPreferences] = useState({
    serviceStatusChanges: true,
    newIncidents: true,
    incidentUpdates: true,
    incidentResolved: true,
  })

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const token = await getToken()
        const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me/notification-preferences`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const prefsData = await response.json()
          setPreferences({
            serviceStatusChanges: prefsData.serviceStatusChanges,
            newIncidents: prefsData.newIncidents,
            incidentUpdates: prefsData.incidentUpdates,
            incidentResolved: prefsData.incidentResolved,
          })
        } else if (response.status !== 404) {
          // 404 is expected for new users, use defaults
          throw new Error("Failed to fetch notification preferences")
        }
      } catch (error) {
        console.error("Error fetching preferences:", error)
        toast("Failed to load notification preferences",{
          description: "Using default preferences",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreferences()
  }, [getToken])

  const handleSavePreferences = async () => {
    setIsSaving(true)
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me/notification-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        throw new Error("Failed to update notification preferences")
      }

     
      toast("Success",{
        description : "Notification preferences updated successfully",
      })
    } catch (error) {
      console.error("Error updating preferences:", error)
     
      toast("Error",{
        description : "Failed to update notification preferences",
      })
      
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Email Notification Preferences</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="service-status">Service Status Changes</Label>
                <p className="text-sm text-gray-500">Receive notifications when a service status changes</p>
              </div>
              <Switch
                id="service-status"
                checked={preferences.serviceStatusChanges}
                onCheckedChange={(checked) => setPreferences({ ...preferences, serviceStatusChanges: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="new-incidents">New Incidents</Label>
                <p className="text-sm text-gray-500">Receive notifications when new incidents are reported</p>
              </div>
              <Switch
                id="new-incidents"
                checked={preferences.newIncidents}
                onCheckedChange={(checked) => setPreferences({ ...preferences, newIncidents: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="incident-updates">Incident Updates</Label>
                <p className="text-sm text-gray-500">
                  Receive notifications when there are updates to existing incidents
                </p>
              </div>
              <Switch
                id="incident-updates"
                checked={preferences.incidentUpdates}
                onCheckedChange={(checked) => setPreferences({ ...preferences, incidentUpdates: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="incident-resolved">Incident Resolved</Label>
                <p className="text-sm text-gray-500">Receive notifications when incidents are resolved</p>
              </div>
              <Switch
                id="incident-resolved"
                checked={preferences.incidentResolved}
                onCheckedChange={(checked) => setPreferences({ ...preferences, incidentResolved: checked })}
              />
            </div>

            <Button onClick={handleSavePreferences} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
