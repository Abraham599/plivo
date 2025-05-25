import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface NotificationPreferences {
  serviceStatusChanges: boolean;
  newIncidents: boolean;
  incidentUpdates: boolean;
  incidentResolved: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function DashboardSettings() {
  const { getToken } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    serviceStatusChanges: true,
    newIncidents: true,
    incidentUpdates: true,
    incidentResolved: true,
  });

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No authentication token available");
        }

        const response = await fetch(`${API_URL}/users/me/notification-preferences`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch notification preferences");
        }

        const data = await response.json();
        setPreferences(data || preferences);
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
        toast.error("Failed to load notification preferences");
      }
    };

    fetchPreferences();
  }, [getToken]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`${API_URL}/users/notification-preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          [key]: value,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update notification preferences");
      }

      setPreferences((prev) => ({ ...prev, [key]: value }));
      toast.success("Notification preferences updated");
    } catch (error) {
      console.error("Failed to update preference:", error);
      toast.error("Failed to update notification preferences");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Preferences
          </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="serviceStatusChanges">Service Status Changes</Label>
          <Switch
            id="serviceStatusChanges"
            checked={preferences.serviceStatusChanges}
            onCheckedChange={(checked) => updatePreference("serviceStatusChanges", checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="newIncidents">New Incidents</Label>
          <Switch
            id="newIncidents"
            checked={preferences.newIncidents}
            onCheckedChange={(checked) => updatePreference("newIncidents", checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="incidentUpdates">Incident Updates</Label>
          <Switch
            id="incidentUpdates"
            checked={preferences.incidentUpdates}
            onCheckedChange={(checked) => updatePreference("incidentUpdates", checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="incidentResolved">Incident Resolved</Label>
          <Switch
            id="incidentResolved"
            checked={preferences.incidentResolved}
            onCheckedChange={(checked) => updatePreference("incidentResolved", checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
