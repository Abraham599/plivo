import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useServiceStore, type Service } from "../stores/serviceStore";

type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";
import { useOrganizationStore } from "../stores/organizationStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreVertical, Edit, Trash, BarChart2, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { UptimeMetrics } from "@/components/UptimeMetrics";

const statusOptions = [
  { value: "operational", label: "Operational" },
  { value: "degraded", label: "Degraded Performance" },
  { value: "partial_outage", label: "Partial Outage" },
  { value: "major_outage", label: "Major Outage" },
  { value: "maintenance", label: "Maintenance" },
] as const;

// Helper to get status color
const getStatusColor = (status: ServiceStatus): string => {
  switch (status) {
    case "operational": return "bg-green-500";
    case "degraded": return "bg-yellow-500";
    case "partial_outage": return "bg-orange-500";
    case "major_outage": return "bg-red-500";
    case "maintenance": return "bg-blue-500";
    default: return "bg-gray-500";
  }
};

// Helper to format status display names
const formatStatusDisplayName = (status: ServiceStatus): string => {
  const option = statusOptions.find(opt => opt.value === status);
  return option ? option.label : status;
};

// Status dropdown component
const StatusDropdown = ({
  status,
  onStatusChange,
  className = "",
}: {
  status: ServiceStatus;
  onStatusChange: (status: ServiceStatus) => void;
  className?: string;
}) => {
  console.log("StatusDropdown", status)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`flex items-center gap-2 ${className}`}>
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
          <span>{formatStatusDisplayName(status)}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onStatusChange(option.value as ServiceStatus)}
            className="flex items-center gap-2"
          >
            <div className={`w-3 h-3 rounded-full ${getStatusColor(option.value as ServiceStatus)}`} />
            <span>{option.label}</span>
            {status === option.value && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function ServicesPage() {
  const { services, isLoading, error, fetchServices, createService, updateService, deleteService } = useServiceStore();
  const { getToken } = useAuth();
  const { currentOrganization } = useOrganizationStore(); // Added to get current organization

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMetricsDialogOpen, setIsMetricsDialogOpen] = useState(false);

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServiceEndpoint, setNewServiceEndpoint] = useState("");
  const [newServiceStatus, setNewServiceStatus] = useState<ServiceStatus>("operational");

  // Strongly type editingService
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServiceDescription, setEditServiceDescription] = useState("");
  // Strongly type editServiceStatus and provide a valid default.
  // This default will be overwritten when a service is selected for editing.
  const [editServiceStatus, setEditServiceStatus] = useState<ServiceStatus>("operational");
  const [editServiceEndpoint, setEditServiceEndpoint] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [metricsServiceId, setMetricsServiceId] = useState<string | null>(null);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const token = await getToken();
        const orgId = currentOrganization?.id;

        if (token && orgId) { // Check for both token and orgId
          fetchServices(token); // Pass the token to fetchServices
        } else {
          // Handle cases where token might be null (e.g., user not fully authenticated yet)
          // serviceStore's fetchServices also checks for token and orgId, so this is an additional safeguard.
          console.warn("ServicesPage: Authentication token or Organization ID not yet available.", { hasToken: !!token, hasOrgId: !!orgId });
        }
      } catch (error) {
        console.error("ServicesPage: Error fetching token or services:", error);
        // Optionally, set an error state here to inform the user
      }
    };

    loadServices();
  }, [fetchServices, getToken, currentOrganization?.id]); // Added currentOrganization?.id to dependency array

  const handleCreateService = async () => {
    if (!newServiceName.trim()) {
      toast.error("Service name is required");
      return;
    }

    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    try {
      await createService({
        name: newServiceName,
        description: newServiceDescription,
        url: newServiceEndpoint,
        status: newServiceStatus,
        organizationId: currentOrganization.id,
      });

      setNewServiceName("");
      setNewServiceDescription("");
      setNewServiceEndpoint("");
      setNewServiceStatus("operational");
      setIsCreateDialogOpen(false);
      toast.success("Service created successfully");
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error("Failed to create service");
    }
  };

  // Use Service type for the service parameter
  const handleEditService = (service: Service) => {
    setEditingService(service);
    setEditServiceName(service.name);
    setEditServiceDescription(service.description || "");
    setEditServiceStatus(service.status); // service.status is already ServiceStatus
    setEditServiceEndpoint(service.url || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateService = async () => {
    if (!editingService) {
      toast.error("No service selected for editing.");
      return;
    }
    if (!editServiceName.trim()) {
      toast.error("Service name is required");
      return;
    }

    try {
      await updateService(
        editingService.id,
        {
          name: editServiceName,
          description: editServiceDescription,
          status: editServiceStatus,
          url: editServiceEndpoint,
        }
      );
      setIsEditDialogOpen(false);
      toast.success("Service updated successfully");
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Failed to update service");
    }
  };

  const handleDeleteService = async () => {
    if (deletingServiceId) {
      try {
        await deleteService(deletingServiceId);
        setIsDeleteDialogOpen(false);
        setDeletingServiceId(null);
        toast.success("Service deleted successfully");
      } catch (error) {
        console.error("Error deleting service:", error);
        toast.error("Failed to delete service");
      }
    }
  };

  // Use Service type for the service parameter
  const handleViewMetrics = (service: Service) => {
    setSelectedService(service);
    setMetricsServiceId(service.id);
    setIsMetricsDialogOpen(true);
  };

  // Status color helper is already defined at the top of the file

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Services</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>Add Service</Button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>All Services</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : services.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No services found. Create your first service to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {services.map((service) => (
                <div key={service.id} className="flex justify-between items-center p-4 border rounded-md">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    {service.description && <p className="text-sm text-gray-500">{service.description}</p>}
                    {service.url && (
                      <p className="text-xs text-gray-400 mt-1">
                        Monitoring: <span className="font-mono">{service.url}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <StatusDropdown
                      status={service.status}
                      onStatusChange={async (newStatus) => {
                        try {
                          const token = await getToken();
                          if (!token) {
                            toast.error("Authentication required");
                            return;
                          }
                          await updateService(
                            service.id,
                            { status: newStatus }
                          );
                          toast.success("Status updated successfully");
                        } catch (error) {
                          console.error("Error updating status:", error);
                          toast.error("Failed to update status");
                        }
                      }}
                      className="text-sm"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditService(service)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {service.url && (
                          <DropdownMenuItem onClick={() => handleViewMetrics(service)}>
                            <BarChart2 className="h-4 w-4 mr-2" />
                            View Metrics
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setDeletingServiceId(service.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="text-red-600"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Service Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter service name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter service description"
                value={newServiceDescription}
                onChange={(e) => setNewServiceDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={newServiceStatus}
                onValueChange={(value: ServiceStatus) => setNewServiceStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="degraded">Degraded Performance</SelectItem>
                  <SelectItem value="partial_outage">Partial Outage</SelectItem>
                  <SelectItem value="major_outage">Major Outage</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint (Optional)</Label>
              <Input
                id="endpoint"
                placeholder="https://example.com/health"
                value={newServiceEndpoint}
                onChange={(e) => setNewServiceEndpoint(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500">
              If provided, we'll periodically check this URL to monitor the service's uptime.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateService}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {/* Ensure editingService is populated before rendering form */}
          {editingService && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Textarea
                  id="edit-description"
                  value={editServiceDescription}
                  onChange={(e) => setEditServiceDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <StatusDropdown
                  status={editServiceStatus}
                  onStatusChange={(status) => setEditServiceStatus(status)}
                  className="w-full justify-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endpoint">Monitoring URL (optional)</Label>
                <Input
                  id="edit-endpoint"
                  value={editServiceEndpoint}
                  onChange={(e) => setEditServiceEndpoint(e.target.value)}
                  placeholder="e.g., https://api.example.com/health"
                />
                 <p className="text-xs text-gray-500">
                   If provided, we'll periodically check this URL to monitor the service's uptime.
                 </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateService}>Update</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Service Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this service? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteService}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={isMetricsDialogOpen} onOpenChange={setIsMetricsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Service Metrics: {selectedService?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto">
            {metricsServiceId ? (
              <UptimeMetrics serviceId={metricsServiceId} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Loading metrics...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}