import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useIncidentStore, type IncidentStatus } from "../stores/incidentStore";
import { useServiceStore } from "../stores/serviceStore";
import { useOrganizationStore } from "../stores/organizationStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function NewIncidentPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { createIncident } = useIncidentStore();
  const { services, fetchServices } = useServiceStore();
  const { } = useOrganizationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "investigating" as IncidentStatus,
    serviceIds: [] as string[],
  });

  // Fetch services when component mounts
  useEffect(() => {
    getToken().then(token => {
      if (token) fetchServices(token);
    });
  }, [fetchServices]);

  // Fetch initial data
  useEffect(() => {
    const initData = async () => {
      try {
        const token = await getToken();
        if (!token) {
          toast.error("Authentication token not available");
          return;
        }
        await fetchServices(token);
      } catch (error) {
        console.error("Failed to initialize data:", error);
        toast.error("Failed to load services");
      }
    };
    initData();
  }, [getToken, fetchServices]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value as IncidentStatus }));
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData((prev) => {
      const serviceIds = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      return { ...prev, serviceIds };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Description is required");
      return;
    }
    
    if (formData.serviceIds.length === 0) {
      toast.error("Please select at least one service");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available");
      }

      // Call the createIncident function with all required parameters
      await createIncident(
        getToken,
        formData.title.trim(),
        formData.description.trim(),
        formData.status,
        formData.serviceIds
      );
      
      toast.success("Incident created successfully");
      navigate("/dashboard");
    } catch (error) {
      toast.error(typeof error === 'string' ? error : "Failed to create incident");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Button 
        variant="ghost" 
        className="mb-4 flex items-center gap-1"
        onClick={() => navigate("/dashboard")}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Incident</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Incident Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter incident title"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the incident"
                rows={3}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Affected Services *</Label>
              <div className="border rounded-md p-4 space-y-2">
                {services.length === 0 ? (
                  <p className="text-sm text-gray-500">No services available. Please create a service first.</p>
                ) : (
                  services.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`service-${service.id}`}
                        checked={formData.serviceIds.includes(service.id)}
                        onCheckedChange={() => handleServiceToggle(service.id)}
                      />
                      <Label 
                        htmlFor={`service-${service.id}`}
                        className="cursor-pointer"
                      >
                        {service.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting || formData.serviceIds.length === 0} 
              className="w-full"
            >
              {isSubmitting ? "Creating..." : "Create Incident"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
