import { useState } from "react";
import type { Organization } from "../api/userApi";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
const getApiUrl = () => import.meta.env.VITE_API_URL || "http://localhost:8000";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

interface OrganizationSelectorProps {
  organizations: Organization[];
  selectedOrganization: Organization | null;
  onOrganizationChange: (organization: Organization) => void;
  onOrganizationCreated: (organization: Organization) => void;
}

export function OrganizationSelector({
  organizations,
  selectedOrganization,
  onOrganizationChange,
  onOrganizationCreated,
}: OrganizationSelectorProps) {
  const { getToken } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error("Please enter an organization name");
      return;
    }

    setIsCreating(true);
    try {
      const token = await getToken();
      const response = await fetch(`${getApiUrl()}/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newOrgName }),
      });

      if (!response.ok) throw new Error("Failed to create organization");

      const newOrg = await response.json();
      onOrganizationCreated(newOrg);
      setNewOrgName("");
      setIsCreateDialogOpen(false);
      toast.success("Organization created successfully");
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedOrganization?.id}
        onValueChange={(value) => {
          const org = organizations.find(org => org.id === value);
          if (org) onOrganizationChange(org);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Create Organization
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to manage your services and incidents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="col-span-3"
                placeholder="Enter organization name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateOrganization}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
