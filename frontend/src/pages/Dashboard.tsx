"use client"

import { useEffect } from "react"
import { useServiceStore, type Service, type ServiceStatus } from "../stores/serviceStore"
import { useIncidentStore, type Incident, type IncidentStatus } from "../stores/incidentStore"
import { useAuth } from "@clerk/clerk-react"; // Import useAuth
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Link } from "react-router-dom"
import { ServiceUptimeCard } from "../components/ServiceUptimeCard"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"; // For loading indicators

// Helper to format status display names for Services
const formatServiceStatusDisplayName = (status: ServiceStatus): string => {
  switch (status) {
    case "operational": return "Operational";
    case "degraded": return "Degraded Performance";
    case "partial_outage": return "Partial Outage";
    case "major_outage": return "Major Outage";
    case "maintenance": return "Maintenance";
    default:
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
  }
};

// Helper to format status display names for Incidents
const formatIncidentStatusDisplayName = (status: IncidentStatus): string => {
  switch (status) {
    case "investigating": return "Investigating";
    case "identified": return "Identified";
    case "monitoring": return "Monitoring";
    case "resolved": return "Resolved";
    default:
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
  }
};

export default function Dashboard() {
  const { services, fetchServices, isLoading: servicesLoading, error: servicesError } = useServiceStore();
  const { incidents, fetchIncidents, isLoading: incidentsLoading, error: incidentsError } = useIncidentStore();
  const { getToken, isLoaded: authIsLoaded } = useAuth(); // Get getToken from Clerk's hook

  useEffect(() => {
    // fetchServices doesn't require getToken in its current implementation
    fetchServices();

    if (authIsLoaded && getToken) { // Ensure auth is loaded and getToken is available
        fetchIncidents(getToken);
    }
  }, [fetchServices, fetchIncidents, getToken, authIsLoaded]); // Add getToken and authIsLoaded to dependency array

  const activeIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const resolvedIncidents = incidents.filter((incident) => incident.status === "resolved");

  const getServiceStatusColor = (status: ServiceStatus): string => {
    switch (status) {
      case "operational": return "bg-green-500";
      case "degraded": return "bg-yellow-500";
      case "partial_outage": return "bg-orange-500";
      case "major_outage": return "bg-red-500";
      case "maintenance": return "bg-blue-500";
      default:
        const exhaustiveCheck: never = status;
        return exhaustiveCheck;
    }
  };

  const getIncidentStatusColor = (status: IncidentStatus): string => {
    switch (status) {
      case "investigating": return "bg-yellow-500";
      case "identified": return "bg-orange-500";
      case "monitoring": return "bg-blue-500";
      case "resolved": return "bg-green-500";
      default:
        const exhaustiveCheck: never = status;
        return exhaustiveCheck;
    }
  };

  const servicesWithUrls = services.filter((service): service is Service & { url: string } => !!service.url);


  if (!authIsLoaded || servicesLoading || incidentsLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (servicesError || incidentsError) {
    return <div className="text-red-500 p-4">Error loading data: {servicesError || incidentsError}</div>;
  }


  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex space-x-2">
          <Button asChild>
            <Link to="/services/new">New Service</Link>
          </Button>
          <Button asChild>
            <Link to="/incidents/new">New Incident</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Services Status ({services.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No services found. Create your first service.</p>
            ) : (
              services.map((service: Service) => (
                <div key={service.id} className="flex justify-between items-center p-4 border rounded-md dark:border-gray-700">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    {service.description && <p className="text-sm text-gray-500 dark:text-gray-400">{service.description}</p>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getServiceStatusColor(service.status)}`} />
                    <span className="text-sm font-medium">
                      {formatServiceStatusDisplayName(service.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {servicesWithUrls.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Uptime Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicesWithUrls.map((service: Service) => (
              <ServiceUptimeCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="active">Active Incidents ({activeIncidents.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved Incidents ({resolvedIncidents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {activeIncidents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No active incidents.</p>
              ) : (
                <div className="space-y-4">
                  {activeIncidents.map((incident: Incident) => (
                    <div key={incident.id} className="p-4 border rounded-md dark:border-gray-700">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                        <div>
                          <h3 className="font-medium">{incident.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{format(new Date(incident.createdAt), "PPP p")}</p>
                        </div>
                        <Badge className={`${getIncidentStatusColor(incident.status)} text-white`}>
                          {formatIncidentStatusDisplayName(incident.status)}
                        </Badge>
                      </div>
                      {incident.description && <p className="text-sm mb-2 whitespace-pre-wrap">{incident.description}</p>}
                      {incident.services && incident.services.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Affected Services:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {incident.services.map((service) => (
                              <Badge key={service.id} variant="outline">
                                {service.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <Link to={`/incidents/${incident.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                        View details
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="resolved">
          <Card>
            <CardContent className="pt-6">
              {resolvedIncidents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No resolved incidents.</p>
              ) : (
                <div className="space-y-4">
                  {resolvedIncidents.map((incident: Incident) => (
                    <div key={incident.id} className="p-4 border rounded-md dark:border-gray-700">
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                        <div>
                          <h3 className="font-medium">{incident.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Created: {format(new Date(incident.createdAt), "PPP p")}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Resolved: {format(new Date(incident.updatedAt), "PPP p")}</p>
                        </div>
                        <Badge className={`${getIncidentStatusColor(incident.status)} text-white`}>
                          {formatIncidentStatusDisplayName(incident.status)}
                        </Badge>
                      </div>
                      {incident.description && <p className="text-sm mb-2 whitespace-pre-wrap">{incident.description}</p>}
                      {incident.services && incident.services.length > 0 && (
                         <div className="mb-2">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Affected Services:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {incident.services.map((service) => (
                              <Badge key={service.id} variant="outline">
                                {service.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <Link to={`/incidents/${incident.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                        View details
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}