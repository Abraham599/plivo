"use client"

import { useEffect, useState } from "react"
import type { Service, ServiceStatus } from "../stores/serviceStore"
import type { Incident } from "../stores/incidentStore"
import type { IncidentStatus } from "../lib/format"
import type { Organization } from "../api/userApi"
import { useAuth } from "@clerk/clerk-react"
import { format } from "date-fns"
import { getApiUrl } from "../lib/api"
import { formatServiceStatusDisplayName, formatIncidentStatusDisplayName } from "../lib/format"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router-dom"
import { ServiceUptimeCard } from "../components/ServiceUptimeCard"
import { Button } from "@/components/ui/button"
import { MoreVertical, ArrowUpDown, Clock, AlertCircle, MessageSquare, Check, Pencil, Bell, Loader2 } from "lucide-react";
import { ServiceEditModal } from "../components/ServiceEditModal";
import { IncidentUpdateModal } from "../components/IncidentUpdateModal";
import { DashboardSettings } from "../components/DashboardSettings"
import { OrganizationSelector } from "../components/OrganizationSelector"
import { IncidentModal } from "../components/IncidentModal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

export default function Dashboard() {
  const { isLoaded: authIsLoaded } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken } = useAuth();

  const fetchData = async (organizationId?: string | null): Promise<void> => {
    try {
      const token = await getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      // Fetch services
      const servicesResponse = await fetch(
        `${getApiUrl()}/services${organizationId ? `?organization_id=${organizationId}` : ''}`, 
        { headers }
      );
      if (!servicesResponse.ok) throw new Error("Failed to fetch services");
      const servicesData = await servicesResponse.json();
      setServices(servicesData);

      // Fetch incidents
      const incidentsResponse = await fetch(
        `${getApiUrl()}/incidents${organizationId ? `?organization_id=${organizationId}` : ''}`,
        { headers }
      );
      if (!incidentsResponse.ok) throw new Error("Failed to fetch incidents");
      const incidentsData = await incidentsResponse.json();
      setIncidents(incidentsData);

      // Fetch organizations
      const orgsResponse = await fetch(
        `${getApiUrl()}/organizations`,
        { headers }
      );
      if (!orgsResponse.ok) throw new Error("Failed to fetch organizations");
      const orgsData = await orgsResponse.json();
      setOrganizations(orgsData);
      
      // Set first organization as selected if none selected
      if (!selectedOrganization && orgsData.length > 0) {
        setSelectedOrganization(orgsData[0]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
      setIsLoading(false);
    }
  };

  // Function to update service status - used in dropdown menu
  const updateServiceStatus = async (serviceId: string, newStatus: string): Promise<void> => {
    const token = await getToken();
    const response = await fetch(`${getApiUrl()}/services/${serviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus.toLowerCase().replace(/ /g, "_") }),
    });
    if (!response.ok) throw new Error('Failed to update service');
    return response.json();
  };

  // Function to update incident
  const updateIncident = async (incidentId: string, updates: Partial<Incident>): Promise<Incident> => {
    const token = await getToken();
    const response = await fetch(`${getApiUrl()}/incidents/${incidentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update incident');
    return response.json();
  };

  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedServiceForIncident, setSelectedServiceForIncident] = useState<string | undefined>(undefined);
  const [selectedServiceForEdit, setSelectedServiceForEdit] = useState<Service | undefined>(undefined);
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<Incident | undefined>(undefined);

  const handleOrganizationChange = async (organization: Organization): Promise<void> => {
    try {
      const token = await getToken();
      // Switch organization in backend
      const response = await fetch(`${getApiUrl()}/organizations/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ organization_id: organization.id })
      });
      
      if (!response.ok) throw new Error('Failed to switch organization');
      
      setSelectedOrganization(organization);
      // Refetch data for new organization
      await fetchData(organization.id);
      toast.success('Switched to ' + organization.name);
    } catch (error) {
      console.error('Error switching organization:', error);
      toast.error('Failed to switch organization');
    }
  };

  const handleOrganizationCreated = (organization: Organization) => {
    setOrganizations(prev => [...prev, organization]);
    handleOrganizationChange(organization);
  };

  useEffect(() => {
    if (!authIsLoaded) return;

    const loadData = async () => {
      await fetchData(selectedOrganization?.id);
    };

    loadData();
  }, [authIsLoaded, selectedOrganization?.id]);

  // Data loading effect only - no auto-refresh

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
      case "scheduled": return "bg-purple-500";
      default:
        const exhaustiveCheck: never = status;
        return exhaustiveCheck;
    }
  };

  // Type guard to ensure service has a URL property
const servicesWithUrls = services.filter((service): service is Service & { url: string } => !!service.url);

  if (!authIsLoaded) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <OrganizationSelector
              organizations={organizations}
              selectedOrganization={selectedOrganization}
              onOrganizationChange={handleOrganizationChange}
              onOrganizationCreated={handleOrganizationCreated}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Bell className="h-4 w-4 mr-2" />
            Notification Settings
          </Button>
        </div>
        <Button onClick={() => setShowIncidentModal(true)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          Report Incident
        </Button>
      </div>

      {showSettings && <DashboardSettings />}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Services Status ({services.length})</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSortBy(sortBy === 'name' ? 'status' : 'name')}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No services found. Create your first service.</p>
            ) : (
              [...services]
                .sort((a, b) => {
                  if (sortBy === 'name') return a.name.localeCompare(b.name);
                  return a.status.localeCompare(b.status);
                })
                .map((service: Service) => (
                  <div key={service.id} className="flex justify-between items-center p-4 border rounded-md dark:border-gray-700">
                    <div>
                      <h3 className="font-medium">{service.name}</h3>
                      {service.description && <p className="text-sm text-gray-500 dark:text-gray-400">{service.description}</p>}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getServiceStatusColor(service.status)}`} />
                        <span className="text-sm font-medium">
                          {formatServiceStatusDisplayName(service.status)}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {Object.entries({
                            operational: "Operational",
                            degraded: "Degraded Performance",
                            partial_outage: "Partial Outage",
                            major_outage: "Major Outage",
                            maintenance: "Maintenance"
                          } as const).map(([_, value]) => value).map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={async () => {
                                try {
                                  await updateServiceStatus(service.id, status.toLowerCase().replace(/ /g, "_"));
                                  if (selectedOrganization?.id) {
                                    await fetchData(selectedOrganization.id);
                                  }
                                  toast.success(`Updated ${service.name} status to ${status}`);
                                } catch (error) {
                                  toast.error(`Failed to update ${service.name} status`);
                                }
                              }}
                            >
                              {status}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedServiceForEdit(service);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Service
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedServiceForIncident(service.id);
                              setShowIncidentModal(true);
                            }}
                            className="text-red-600 dark:text-red-400"
                          >
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Report Incident
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            {servicesWithUrls.map((service) => (
              <ServiceUptimeCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      )}

      <IncidentModal
        open={showIncidentModal}
        onOpenChange={setShowIncidentModal}
        services={services}
        onIncidentCreated={async () => {
          const token = await getToken();
          if (token) await fetchData(selectedOrganization?.id);
        }}
        selectedServiceId={selectedServiceForIncident}
        organizationId={selectedOrganization?.id}
      />

      <IncidentModal
        open={showMaintenanceModal}
        onOpenChange={setShowMaintenanceModal}
        services={services}
        onIncidentCreated={async () => {
          const token = await getToken();
          if (token) await fetchData(selectedOrganization?.id);
        }}
        type="maintenance"
        organizationId={selectedOrganization?.id}
      />

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="active">Active Incidents ({activeIncidents.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Scheduled Maintenance</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedIncidents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {activeIncidents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No active incidents.</p>
              ) : (
                <div className="space-y-4">
                  {activeIncidents.map((incident) => (
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
                      <div className="flex items-center gap-4 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await updateIncident(incident.id, { status: "resolved" });
                              const token = await getToken();
                              if (token) await fetchData(selectedOrganization?.id);
                              toast.success("Incident resolved");
                            } catch (error) {
                              toast.error("Failed to resolve incident");
                            }
                          }}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedIncidentForUpdate(incident)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Update
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="maintenance">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Scheduled Maintenance</h3>
                <Button onClick={() => setShowMaintenanceModal(true)}>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Maintenance
                </Button>
              </div>
              {incidents
                .filter((incident) => incident.status === "scheduled")
                .map((incident) => (
                  <div key={incident.id} className="p-4 border rounded-md dark:border-gray-700 mb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                      <div>
                        <h3 className="font-medium">{incident.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Scheduled for: {format(new Date(incident.createdAt), "PPP p")}
                        </p>
                      </div>
                      <Badge variant="outline">
                        Scheduled
                      </Badge>
                    </div>
                    {incident.description && <p className="text-sm mb-2 whitespace-pre-wrap">{incident.description}</p>}
                    <div className="flex items-center gap-4 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await updateIncident(incident.id, { status: "monitoring" });
                            const token = await getToken();
                            if (token) await fetchData(selectedOrganization?.id);
                            toast.success("Maintenance started");
                          } catch (error) {
                            toast.error("Failed to start maintenance");
                          }
                        }}
                      >
                        Start Maintenance
                      </Button>
                     
                    </div>
                  </div>
                ))}
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
                  {resolvedIncidents.map((incident) => (
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
                      <div className="flex items-center gap-4 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await updateIncident(incident.id, { status: "resolved" });
                              const token = await getToken();
                              if (token) await fetchData(selectedOrganization?.id);
                              toast.success("Incident resolved");
                            } catch (error) {
                              toast.error("Failed to resolve incident");
                            }
                          }}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedIncidentForUpdate(incident)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Update
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedServiceForEdit && (
        <ServiceEditModal
          open={!!selectedServiceForEdit}
          onOpenChange={(open) => !open && setSelectedServiceForEdit(undefined)}
          service={selectedServiceForEdit}
          onServiceUpdated={async () => {
            const token = await getToken();
            if (token) await fetchData(selectedOrganization?.id);
          }}
        />
      )}

      {selectedIncidentForUpdate && (
        <IncidentUpdateModal
          open={!!selectedIncidentForUpdate}
          onOpenChange={(open) => !open && setSelectedIncidentForUpdate(undefined)}
          incident={selectedIncidentForUpdate}
          onUpdateAdded={async () => {
            const token = await getToken();
            if (token) await fetchData(selectedOrganization?.id);
          }}
        />
      )}
    </div>
  );
}