import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useServiceStore, type Service, type ServiceStatus } from "../stores/serviceStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { UptimeMetricsChart } from "@/components/UptimeMetricsChart";

// Helper to format status display names
const formatStatusDisplayName = (status: ServiceStatus): string => {
  switch (status) {
    case "operational": return "Operational";
    case "degraded": return "Degraded Performance";
    case "partial_outage": return "Partial Outage";
    case "major_outage": return "Major Outage";
    case "maintenance": return "Maintenance";
    default:
      // This should not happen with proper typing, but as a fallback:
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
  }
};

export default function ServicesPage() {
  const { user } = useUser();
  const { services, isLoading, error, fetchServices, createService, updateService, deleteService } = useServiceStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMetricsDialogOpen, setIsMetricsDialogOpen] = useState(false);

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServiceEndpoint, setNewServiceEndpoint] = useState("");

  // Strongly type editingService
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServiceDescription, setEditServiceDescription] = useState("");
  // Strongly type editServiceStatus and provide a valid default.
  // This default will be overwritten when a service is selected for editing.
  const [editServiceStatus, setEditServiceStatus] = useState<ServiceStatus>("operational");
  const [editServiceEndpoint, setEditServiceEndpoint] = useState("");

  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  // Strongly type selectedServiceForMetrics
  const [selectedServiceForMetrics, setSelectedServiceForMetrics] = useState<Service | null>(null);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleCreateService = async () => {
    if (!newServiceName.trim()) {
      toast("Error", { description: "Service name is required" });
      return;
    }
    if (!user?.organizationMemberships?.[0]?.organization?.id) {
      toast("Error", { description: "Organization not found" });
      return;
    }

    try {
      await createService({
        name: newServiceName,
        description: newServiceDescription,
        url: newServiceEndpoint,
        status: "operational", // This is a valid ServiceStatus
        organizationId: user.organizationMemberships[0].organization.id,
      });

      setNewServiceName("");
      setNewServiceDescription("");
      setNewServiceEndpoint("");
      setIsCreateDialogOpen(false);
      toast("Success", { description: "Service created successfully" });
    } catch (e: any) {
      toast("Error", { description: e.message || "Failed to create service" });
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
      toast("Error", { description: "No service selected for editing." });
      return;
    }
    if (!editServiceName.trim()) {
      toast("Error", { description: "Service name is required" });
      return;
    }

    try {
      await updateService(editingService.id, {
        name: editServiceName,
        description: editServiceDescription,
        status: editServiceStatus, // editServiceStatus is now ServiceStatus
        url: editServiceEndpoint,
      });
      setIsEditDialogOpen(false);
      toast("Success", { description: "Service updated successfully" });
    } catch (e: any) {
      toast("Error", { description: e.message || "Failed to update service" });
    }
  };

  const handleDeleteService = async () => {
    if (deletingServiceId) {
      try {
        await deleteService(deletingServiceId);
        setIsDeleteDialogOpen(false);
        setDeletingServiceId(null);
        toast("Success", { description: "Service deleted successfully" });
      } catch (e: any) {
        toast("Error", { description: e.message || "Failed to delete service" });
      }
    }
  };

  // Use Service type for the service parameter
  const handleViewMetrics = (service: Service) => {
    setSelectedServiceForMetrics(service);
    setIsMetricsDialogOpen(true);
  };

  // Use ServiceStatus for the status parameter
  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case "operational": return "bg-green-500";
      case "degraded": return "bg-yellow-500";
      case "partial_outage": return "bg-orange-500";
      case "major_outage": return "bg-red-500";
      case "maintenance": return "bg-blue-500";
      default:
        // This should not be reached if status is strictly ServiceStatus
        const exhaustiveCheck: never = status;
        return exhaustiveCheck; // Or a fallback like "bg-gray-500"
    }
  };

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
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
                      <span className="text-sm font-medium">
                        {formatStatusDisplayName(service.status)}
                      </span>
                    </div>
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
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="e.g., Website, API, Database"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newServiceDescription}
                onChange={(e) => setNewServiceDescription(e.target.value)}
                placeholder="Brief description of the service"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Monitoring URL (optional)</Label>
              <Input
                id="endpoint"
                value={newServiceEndpoint}
                onChange={(e) => setNewServiceEndpoint(e.target.value)}
                placeholder="e.g., https://api.example.com/health"
              />
              <p className="text-xs text-gray-500">
                If provided, we'll periodically check this URL to monitor the service's uptime.
              </p>
            </div>
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
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editServiceStatus} // editServiceStatus is ServiceStatus
                  // Cast the string value from Select to ServiceStatus
                  onValueChange={(value) => setEditServiceStatus(value as ServiceStatus)}
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
            <DialogTitle>Uptime Metrics</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedServiceForMetrics && (
              <UptimeMetricsChart
                serviceId={selectedServiceForMetrics.id}
                serviceName={selectedServiceForMetrics.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}