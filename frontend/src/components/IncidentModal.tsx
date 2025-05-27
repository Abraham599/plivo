import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import type { Service } from "../stores/serviceStore";
import { toast } from "sonner";
import { useAuth } from "@clerk/clerk-react";

const getApiUrl = () => import.meta.env.VITE_API_URL || "http://localhost:8000";

interface IncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  onIncidentCreated: () => void;
  type?: "incident" | "maintenance";
  selectedServiceId?: string;
  organizationId?: string;
}

export function IncidentModal({
  open,
  onOpenChange,
  services,
  onIncidentCreated,
  type = "incident",
  selectedServiceId,
  organizationId,
}: IncidentModalProps) {
  const { getToken } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved" | "scheduled";
  const [status, setStatus] = useState<IncidentStatus>(
    type === "maintenance" ? "scheduled" : "investigating"
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(
    selectedServiceId ? [selectedServiceId] : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || selectedServices.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          status,
          service_ids: selectedServices,
          organization_id: organizationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create incident");

      toast.success(
        type === "maintenance"
          ? "Maintenance scheduled successfully"
          : "Incident reported successfully"
      );
      onIncidentCreated();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating incident:", error);
      toast.error(
        type === "maintenance"
          ? "Failed to schedule maintenance"
          : "Failed to report incident"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus((type === "maintenance" ? "scheduled" : "investigating") as IncidentStatus);
    setSelectedServices(selectedServiceId ? [selectedServiceId] : []);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === "maintenance" ? "Schedule Maintenance" : "Report Incident"}
          </DialogTitle>
          <DialogDescription>
            {type === "maintenance"
              ? "Schedule maintenance for your services"
              : "Report a new incident affecting your services"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter incident title"
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="identified">Identified</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                {type === "maintenance" && (
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="services">Affected Services</Label>
            <Select
              value={selectedServices[0] || ""}
              onValueChange={(value) => setSelectedServices([value])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select services" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? "Submitting..."
              : type === "maintenance"
              ? "Schedule"
              : "Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
