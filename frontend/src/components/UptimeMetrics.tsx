import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { getApiUrl, getAuthHeaders } from '../lib/api';

interface UptimeData {
  timestamp: string;
  status: 'up' | 'down';
  response_time: number;
}

export function UptimeMetrics({ serviceId }: { serviceId: string }) {
  const [uptimeData, setUptimeData] = useState<UptimeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();

  useEffect(() => {
    const fetchUptimeData = async () => {
      try {
        const token = await getToken();
        const headers = getAuthHeaders(token);
        const response = await fetch(
          `${getApiUrl()}/services/${serviceId}/metrics/uptime?period=7d`,
          { headers }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch uptime data');
        }

        const data = await response.json();
        setUptimeData(data);
      } catch (err) {
        console.error('Error fetching uptime data:', err);
        setError('Failed to load uptime data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUptimeData();
  }, [serviceId, getToken]);

  // Calculate uptime percentage
  const uptimePercentage = uptimeData.length > 0
    ? (uptimeData.filter(d => d.status === 'up').length / uptimeData.length) * 100
    : 0;

  // Calculate average response time
  const avgResponseTime = uptimeData.length > 0
    ? (uptimeData.reduce((sum, d) => sum + d.response_time, 0) / uptimeData.length).toFixed(2)
    : 0;

  if (isLoading) return <div>Loading uptime data...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uptime Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Uptime (7d)</p>
            <p className="text-2xl font-bold">{uptimePercentage.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg. Response Time</p>
            <p className="text-2xl font-bold">{avgResponseTime}ms</p>
          </div>
        </div>
        {/* Add a chart here later */}
      </CardContent>
    </Card>
  );
}
