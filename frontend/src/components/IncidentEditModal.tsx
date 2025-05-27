import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import type { Incident, IncidentStatus } from "../stores/incidentStore";
import type { Service } from "../stores/serviceStore";

interface IncidentEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: Incident;
  services: Service[];
  onSave: (incidentData: {
    title: string;
    description: string;
    status: IncidentStatus;
    service_ids: string[];
  }) => Promise<void>;
}

export function IncidentEditModal({ open, onOpenChange, incident, services, onSave }: IncidentEditModalProps) {
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description);
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [selectedServices, setSelectedServices] = useState<string[]>(
    incident.services?.map(s => s.id) || []
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(incident.title);
      setDescription(incident.description);
      setStatus(incident.status);
      setSelectedServices(incident.services?.map(s => s.id) || []);
    }
  }, [open, incident]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (selectedServices.length === 0) {
      toast.error('Please select at least one affected service');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        service_ids: selectedServices
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Incident</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter incident title"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as IncidentStatus)}>
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

          <div>
            <Label>Affected Services</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto p-2 border rounded-md">
              {services.map((service) => (
                <div key={service.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`service-${service.id}`}
                    checked={selectedServices.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor={`service-${service.id}`} className="text-sm font-medium">
                    {service.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter incident description"
              rows={4}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
