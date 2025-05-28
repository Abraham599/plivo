"use client"

import { useEffect, useState } from "react"
import type { Service, ServiceStatus } from "../stores/serviceStore"
import type { Incident } from "../stores/incidentStore"
import { getAuthHeaders, getApiUrl } from "../lib/api"
import type { IncidentStatus } from "../lib/format"
import type { Organization } from "../api/userApi" // Ensure this type matches backend response
import { useAuth } from "@clerk/clerk-react"
import { format } from "date-fns"
import { formatServiceStatusDisplayName, formatIncidentStatusDisplayName } from "../lib/format"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import NotificationPreferences from "@/components/NotificationPreferences"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ServiceUptimeCard } from "../components/ServiceUptimeCard"
import { Button } from "@/components/ui/button"
import { Pencil,  ArrowUpDown, Clock, AlertCircle, MessageSquare, Check, Bell, Loader2, Plus } from "lucide-react"
import { ServiceEditModal } from "../components/ServiceEditModal";
import { IncidentUpdateModal } from "../components/IncidentUpdateModal";
import { IncidentEditModal } from "../components/IncidentEditModal";
import { OrganizationSelector } from "../components/OrganizationSelector"
import { IncidentModal } from "../components/IncidentModal"
import { toast } from "sonner"

export default function Dashboard() {
  const { isLoaded: authIsLoaded, getToken } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      if (!authIsLoaded) {
        return;
      }
      const token = await getToken();
      if (!token) {
        setIsPageLoading(false);
        return;
      }
      await fetchData(selectedOrganization?.id, token);
    };

    loadAllData();
  }, [authIsLoaded, getToken, selectedOrganization]);

  const fetchData = async (organizationId?: string | null, token?: string | null): Promise<void> => {
    setIsPageLoading(true);
    try {
      const headers = getAuthHeaders(token);
      
      const servicesResponse = await fetch(
        `${getApiUrl()}/services${organizationId ? `?organization_id=${organizationId}` : ''}`, 
        { headers }
      );
      if (!servicesResponse.ok) throw new Error("Failed to fetch services");
      const servicesData = await servicesResponse.json();
      setServices(servicesData);

      const incidentsResponse = await fetch(
        `${getApiUrl()}/incidents${organizationId ? `?organization_id=${organizationId}` : ''}`,
        { headers }
      );
      if (!incidentsResponse.ok) throw new Error("Failed to fetch incidents");
      const incidentsData = await incidentsResponse.json();
      setIncidents(incidentsData);

      const orgsResponse = await fetch(
        `${getApiUrl()}/organizations?t=${new Date().getTime()}`,
        { 
          headers,
          cache: 'no-store'
        }
      );
      
      if (!orgsResponse.ok) {
        const errorBody = await orgsResponse.text();
        console.error("Failed to fetch organizations. Status:", orgsResponse.status, "Body:", errorBody);
        throw new Error(`Failed to fetch organizations (status ${orgsResponse.status})`);
      }
      
      const orgsData = await orgsResponse.json();
      const validOrgs = Array.isArray(orgsData) ? orgsData : [];
      setOrganizations(validOrgs);
      
      if (isInitialLoad || !selectedOrganization || !validOrgs.some(org => org.id === selectedOrganization?.id)) {
        if (validOrgs.length > 0) {
          setSelectedOrganization(validOrgs[0]);
        } else {
          setSelectedOrganization(null);
        }
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data. " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsPageLoading(false);
    }
  };
console.log(services);
  // const updateServiceStatus = async (serviceId: string, newStatusDisplayName: string): Promise<void> => {
  //   try {
  //     const token = await getToken();
  //     if (!token) {
  //       toast.error('Authentication required');
  //       throw new Error('Authentication required');
  //     }
      
  //     const statusMapToBackend: Record<string, ServiceStatus> = {
  //       'Operational': 'operational',
  //       'Degraded Performance': 'degraded',
  //       'Partial Outage': 'partial_outage',
  //       'Major Outage': 'major_outage',
  //       'Maintenance': 'maintenance'
  //     };
      
  //     const backendStatus = statusMapToBackend[newStatusDisplayName];

  //     if (!backendStatus) {
  //       const errorMessage = `Invalid status: ${newStatusDisplayName}`;
  //       console.error(errorMessage);
  //       toast.error(errorMessage);
  //       throw new Error(errorMessage);
  //     }
      
  //     const response = await fetch(`${getApiUrl()}/services/${serviceId}`, {
  //       method: 'PUT',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${token}`,
  //       },
  //       body: JSON.stringify({ status: backendStatus }),
  //     });
      
  //     if (!response.ok) {
  //       const errorData = await response.json().catch(() => ({ detail: 'Failed to update service status' }));
  //       throw new Error(errorData.detail || 'Failed to update service status');
  //     }
      
  //     await fetchData(selectedOrganization?.id, token);
  //     // Success toast is now handled by the caller (DropdownMenuItem) for better context
  //   } catch (error) {
  //     console.error('Error updating service status:', error);
  //     toast.error(error instanceof Error ? error.message : 'Failed to update service status');
  //     throw error; // Re-throw for the caller
  //   }
  // };

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
    const updatedIncident = await response.json();
    if (token) await fetchData(selectedOrganization?.id, token);
    return updatedIncident;
  };

  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedServiceForIncident, ] = useState<string | undefined>(undefined);
  const [selectedServiceForEdit, setSelectedServiceForEdit] = useState<Service | null>(null);
  const [isServiceEditModalOpen, setIsServiceEditModalOpen] = useState(false);
  const [selectedIncidentForEdit, setSelectedIncidentForEdit] = useState<Incident | null>(null);

  const handleCreateService = async (serviceData: { name: string; description?: string; endpoint?: string }) => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      
      if (!selectedOrganization?.id) {
        toast.error('Please select an organization first');
        return;
      }

      const response = await fetch(`${getApiUrl()}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: serviceData.name,
          description: serviceData.description || undefined,
          endpoint: serviceData.endpoint || undefined,
          organization_id: selectedOrganization.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create service');
      }

      const createdService = await response.json();
      toast.success(`Service "${createdService.name}" created successfully`);
      await fetchData(selectedOrganization.id, token);
      return createdService;
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create service');
      throw error;
    }
  };

  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<Incident | undefined>(undefined);

  const handleOrganizationChange = async (organization: Organization): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication token not found.");
        return;
      }
      
      setSelectedOrganization(organization);
      
      const response = await fetch(`${getApiUrl()}/organizations/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ organization_id: organization.id })
      });
      
      if (!response.ok) {
        const currentOrg = organizations.find(org => org.id === selectedOrganization?.id);
        setSelectedOrganization(currentOrg || null);
        
        const errorBody = await response.text();
        console.error("Failed to switch organization. Status:", response.status, "Body:", errorBody);
        throw new Error('Failed to switch organization in backend');
      }
      
      await fetchData(organization.id, token);
      toast.success(`Switched to ${organization.name}`);
    } catch (error) {
      console.error('Error switching organization:', error);
      toast.error('Failed to switch organization. ' + (error instanceof Error ? error.message : ''));
    }
  };

  const handleOrganizationCreated = (organization: Organization) => {
    setOrganizations(prev => [...prev, organization]);
    handleOrganizationChange(organization); 
  };

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
        return "bg-gray-500"; 
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
        return "bg-gray-500"; 
    }
  };

  if (!authIsLoaded && isPageLoading) { 
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
          {isPageLoading && !selectedOrganization ? ( 
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
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              if (!selectedOrganization) {
                toast.error('Please select an organization first');
                return;
              }
              setSelectedServiceForEdit(null); 
              setIsServiceEditModalOpen(true);
            }}
            disabled={!selectedOrganization || isPageLoading} 
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Service
          </Button>
          <Button 
            onClick={() => {
                if (!selectedOrganization) {
                    toast.error('Please select an organization first to report an incident.');
                    return;
                }
                setShowIncidentModal(true);
            }}
            disabled={!selectedOrganization || isPageLoading} 
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Report Incident
          </Button>
        </div>
      </div>

      {showSettings &&  <NotificationPreferences/>}
      
      <ServiceEditModal
        open={isServiceEditModalOpen && selectedServiceForEdit === null}
        onOpenChange={(open) => {
            if (!open) {
                setIsServiceEditModalOpen(false);
            } else {
                setIsServiceEditModalOpen(true);
            }
        }}
        service={null} 
        onSave={async (serviceData) => { 
            try {
                await handleCreateService(serviceData);
                setIsServiceEditModalOpen(false);
            } catch (error) {
                // Error is handled by handleCreateService
            }
        }}
      />

      {selectedServiceForEdit !== null && (
        <ServiceEditModal
          open={isServiceEditModalOpen && selectedServiceForEdit !== null}
          onOpenChange={(open) => {
            setIsServiceEditModalOpen(open);
            if (!open) setSelectedServiceForEdit(null); 
          }}
          service={selectedServiceForEdit} 
          onSave={async (serviceData) => { 
            try {
                const token = await getToken();
                if (!token) {
                    toast.error('Authentication required');
                    return;
                }
                if (!selectedServiceForEdit?.id) return; 

                const response = await fetch(`${getApiUrl()}/services/${selectedServiceForEdit.id}`, {
                    method: 'PUT', 
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(serviceData)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || 'Failed to update service');
                }
                toast.success('Service updated successfully');
                await fetchData(selectedOrganization?.id, token); 
                setIsServiceEditModalOpen(false);
                setSelectedServiceForEdit(null);
            } catch (error) {
                console.error('Error updating service:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to update service');
            }
          }}
        />
      )}
      
    
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Services Status ({services.length})</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSortBy(sortBy === 'name' ? 'status' : 'name')}
              aria-label={sortBy === 'name' ? "Sort by status" : "Sort by name"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isPageLoading && services.length === 0 ? (
                 <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
            ) : services.length === 0 ? (
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
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => {
                            setSelectedServiceForEdit(service);
                            setIsServiceEditModalOpen(true);
                          }}
                          aria-label="Edit service"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="metrics" className="space-y-6">
          <h2 className="text-xl font-semibold mb-4">Service Uptime Metrics</h2>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {services.map((service) => (
              <ServiceUptimeCard 
                key={`graph-${service.id}`} 
                service={service} 
              />
            ))}
          </div>
          
        </TabsContent>
      </Tabs>

    
      <IncidentModal
        open={showIncidentModal}
        onOpenChange={setShowIncidentModal}
        services={services}
        onIncidentCreated={async () => {
          const token = await getToken();
          if (token) await fetchData(selectedOrganization?.id, token);
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
          if (token) await fetchData(selectedOrganization?.id, token);
        }}
        type="maintenance"
        organizationId={selectedOrganization?.id} 
      />

      {selectedIncidentForEdit && (
        <IncidentEditModal
          open={!!selectedIncidentForEdit}
          onOpenChange={(open) => !open && setSelectedIncidentForEdit(null)}
          incident={selectedIncidentForEdit}
          services={services}
          onSave={async (incidentData) => {
            try {
              const token = await getToken();
              if (!token) {
                toast.error('Authentication required');
                return;
              }
              
              const response = await fetch(`${getApiUrl()}/incidents/${selectedIncidentForEdit.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(incidentData)
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to update incident');
              }
              
              toast.success('Incident updated successfully');
              await fetchData(selectedOrganization?.id, token);
              setSelectedIncidentForEdit(null);
            } catch (error) {
              console.error('Error updating incident:', error);
              toast.error(error instanceof Error ? error.message : 'Failed to update incident');
            }
          }}
        />
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="active">Active Incidents ({activeIncidents.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Scheduled Maintenance</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedIncidents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {isPageLoading && activeIncidents.length === 0 ? (
                 <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : activeIncidents.length === 0 ? (
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
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={async () => {
                            try {
                              await updateIncident(incident.id, { status: "resolved" });
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
                          className="flex-1 sm:flex-none"
                          onClick={() => setSelectedIncidentForUpdate(incident)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Update
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => setSelectedIncidentForEdit(incident)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
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
                <Button 
                    onClick={() => {
                        if (!selectedOrganization) {
                            toast.error("Please select an organization first to schedule maintenance.");
                            return;
                        }
                        setShowMaintenanceModal(true)
                    }}
                    disabled={!selectedOrganization || isPageLoading}
                >
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
                 {isPageLoading && incidents.filter((i) => i.status === "scheduled").length === 0 ? (
                     <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     </div>
                 ) : incidents.filter((i) => i.status === "scheduled").length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No scheduled maintenance.</p>
                 )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="resolved">
          <Card>
            <CardContent className="pt-6">
              {isPageLoading && resolvedIncidents.length === 0 ? (
                 <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : resolvedIncidents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No resolved incidents.</p>
              ) : (
                <div className="space-y-4">
                  {resolvedIncidents.map((incident) => (
                    <div key={incident.id} className="p-4 border rounded-md dark:border-gray-700">
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                        <div>
                          <h3 className="font-medium">{incident.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Created: {format(new Date(incident.createdAt), "PPP p")}</p>
                          {incident.updatedAt && <p className="text-sm text-gray-500 dark:text-gray-400">Resolved: {format(new Date(incident.updatedAt), "PPP p")}</p>}
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedIncidentForUpdate && (
        <IncidentUpdateModal
          open={!!selectedIncidentForUpdate}
          onOpenChange={(open) => !open && setSelectedIncidentForUpdate(undefined)}
          incident={selectedIncidentForUpdate}
          onUpdateAdded={async () => {
            const token = await getToken();
            if (token) await fetchData(selectedOrganization?.id, token); 
            setSelectedIncidentForUpdate(undefined); 
          }}
        />
      )}
    </div>
  );
}