import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Switch } from './ui/switch';
import { Button } from './ui/button';

const API_URL = import.meta.env.VITE_API_URL;

interface NotificationPreferences {
  serviceStatusChanges: boolean;
  newIncidents: boolean;
  incidentUpdates: boolean;
  incidentResolved: boolean;
}

const defaultPrefs: NotificationPreferences = {
  serviceStatusChanges: true,
  newIncidents: true,
  incidentUpdates: true,
  incidentResolved: true,
};

const NotificationPreferences: React.FC = () => {
  const { getToken } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch current preferences
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch preferences');
        const data = await res.json();
        setPrefs({
          serviceStatusChanges: data.notificationPreferences?.serviceStatusChanges ?? true,
          newIncidents: data.notificationPreferences?.newIncidents ?? true,
          incidentUpdates: data.notificationPreferences?.incidentUpdates ?? true,
          incidentResolved: data.notificationPreferences?.incidentResolved ?? true,
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  // Save preferences
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/users/me/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card mb-6 max-w-md">
      <h3 className="font-semibold mb-4">Email Notification Preferences</h3>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <span>Service status changes</span>
            <Switch
              checked={prefs.serviceStatusChanges}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, serviceStatusChanges: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>New incidents</span>
            <Switch
              checked={prefs.newIncidents}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, newIncidents: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Incident updates</span>
            <Switch
              checked={prefs.incidentUpdates}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, incidentUpdates: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Incident resolved</span>
            <Switch
              checked={prefs.incidentResolved}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, incidentResolved: v }))}
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full mt-2">
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
          {success && <div className="text-green-600 text-sm mt-2">Preferences saved!</div>}
        </form>
      )}
    </div>
  );
};

export default NotificationPreferences; 