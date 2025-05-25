import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useServiceStore, type ServiceStatus } from "../stores/serviceStore";
import { useOrganizationStore } from "../stores/organizationStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function NewServicePage() {
  const navigate = useNavigate();
  const { createService } = useServiceStore();
  const { fetchOrganizations } = useOrganizationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncData, setSyncData] = useState<{ organization_id: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "operational" as ServiceStatus,
    url: "",
  });

  // Fetch organizations when component mounts
  useEffect(() => {
    const initOrganizations = async () => {
      try {
        const session = await window.Clerk.session;
        if (!session) {
          toast.error('No active session');
          navigate('/');
          return;
        }

        const token = await session.getToken();
        if (!token) {
          toast.error('Failed to get authentication token');
          return;
        }

        // First ensure user is synced
        const syncResponse = await fetch(`${import.meta.env.VITE_API_URL}/users/ensure-synced`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        });
        
        if (!syncResponse.ok) {
          throw new Error('Failed to sync user');
        }
        const syncResponseData = await syncResponse.json();
        console.log('User sync response:', syncResponseData);
        setSyncData(syncResponseData);

        // Then fetch organizations
        const orgs = await fetchOrganizations(token);
        console.log('Fetched organizations:', orgs);
      } catch (error) {
        console.error('Failed to initialize:', error);
        toast.error('Failed to load user data');
      }
    };

    initOrganizations();
  }, [fetchOrganizations, navigate]);

  // Check if we have organization data
  useEffect(() => {
    if (!syncData?.organization_id) {
      toast.error("No organization data available. Please try again.");
    }
  }, [syncData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value as ServiceStatus }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Service name is required");
      return;
    }

    if (!syncData?.organization_id) {
      toast.error("No organization data available");
      return;
    }

    setIsSubmitting(true);

    try {
      const serviceData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || "",
        status: formData.status,
        url: formData.url?.trim() || "",
        organizationId: syncData.organization_id,
      };
      
      await createService(serviceData);
      toast.success("Service created successfully");
      navigate("/dashboard");
    } catch (error) {
      console.error("Service creation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create service"
      );
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
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create New Service</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" method="POST">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter service name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter service description"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="url">Service URL</Label>
              <Input
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Initial Status *</Label>
              <Select
                value={formData.status}
                onValueChange={handleStatusChange}
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
            
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full"
            >
              {isSubmitting ? "Creating..." : "Create Service"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
