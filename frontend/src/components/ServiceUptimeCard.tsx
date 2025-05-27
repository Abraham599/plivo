import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { Service, ServiceStatus } from "../stores/serviceStore"
import { getServiceUptimeMetrics } from "@/lib/api"
import { useAuth } from "@clerk/clerk-react";

interface UptimeMetrics {
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  avgResponseTime: number;
  checks: Array<{
    timestamp: string;
    status: 'up' | 'down';
    responseTime: number | null;
  }>;
}

interface ServiceUptimeCardProps {
  service: Service;
}

export function ServiceUptimeCard({ service }: ServiceUptimeCardProps) {
  const { getToken } = useAuth();
  const [metrics, setMetrics] = useState<UptimeMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const fetchMetrics = async () => {
    if (!service.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getToken();
      const data = await getServiceUptimeMetrics(service.id, token);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching uptime metrics:', err);
      setError('Failed to load uptime data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [service.id]);

  const getUptimePercentage = (): number => {
    if (!metrics) return 0;
    switch (timeRange) {
      case '24h': return metrics.uptime24h;
      case '7d': return metrics.uptime7d;
      case '30d': return metrics.uptime30d;
      default: return 0;
    }
  };

  const uptimePercentage = getUptimePercentage();
  
  // Map status to color
  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'partial_outage': return 'bg-orange-500';
      case 'major_outage': return 'bg-red-500';
      case 'maintenance': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getUptimeLabel = () => {
    switch (timeRange) {
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      default: return '';
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchMetrics();
  };

  // Render loading state
  if (isLoading && !metrics) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2 pb-2">
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-1/4 mt-2" />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {service.name}
          </CardTitle>
          <Badge variant="outline" className="bg-gray-100">
            Error
          </Badge>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {error}
              <button 
                onClick={handleRefresh}
                className="ml-2 text-blue-600 hover:underline flex items-center text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {service.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Badge variant="outline" className={`capitalize ${getStatusColor(service.status).replace('bg-', 'bg-')}`}>
            {service.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">
              {uptimePercentage.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {getUptimeLabel()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">
              {metrics?.avgResponseTime ? `${Math.round(metrics.avgResponseTime)}ms` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg. response
            </p>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Uptime</span>
            <span>{uptimePercentage.toFixed(2)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full ${getStatusColor(service.status)} transition-all duration-500`}
              style={{ width: `${uptimePercentage}%` }}
            />
          </div>
        </div>
        
        <div className="mt-3 flex items-center justify-between text-xs">
          <button 
            onClick={() => setTimeRange('24h')}
            className={`px-2 py-1 rounded ${timeRange === '24h' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
          >
            24h
          </button>
          <button 
            onClick={() => setTimeRange('7d')}
            className={`px-2 py-1 rounded ${timeRange === '7d' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
          >
            7d
          </button>
          <button 
            onClick={() => setTimeRange('30d')}
            className={`px-2 py-1 rounded ${timeRange === '30d' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
          >
            30d
          </button>
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
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-1/4 mt-2" />
      </CardContent>
    </Card>
  )
}