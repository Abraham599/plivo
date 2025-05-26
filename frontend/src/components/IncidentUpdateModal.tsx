import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { useAuth } from "@clerk/clerk-react";
import type { Incident, IncidentStatus } from "../stores/incidentStore";

interface IncidentUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: Incident;
  onUpdateAdded: () => Promise<void>;
}

export function IncidentUpdateModal({ open, onOpenChange, incident, onUpdateAdded }: IncidentUpdateModalProps) {
  const { getToken } = useAuth();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = await getToken();
      // First update the incident status if it changed
      if (status !== incident.status) {
        await fetch(`${import.meta.env.VITE_API_URL}/incidents/${incident.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: status
          }),
        });
      }

      // Then create the update
      const response = await fetch(`${import.meta.env.VITE_API_URL}/incidents/${incident.id}/updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to add update:", errorData);
        throw new Error("Failed to add update");
      }

      await onUpdateAdded();
      onOpenChange(false);
      setMessage("");
      toast.success("Update added successfully");
    } catch (error) {
      toast.error("Failed to add update");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Update</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as IncidentStatus)}>
              <SelectTrigger>
                <SelectValue />
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
            <Label htmlFor="message">Update Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              placeholder="Provide details about the current status..."
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
              Add Update
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
