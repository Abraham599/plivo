"use client"

import { useEffect, useState } from "react"
import { useIncidentStore, type Incident, type IncidentStatus } from "../stores/incidentStore"
import { useServiceStore, type Service } from "../stores/serviceStore"
import { useAuth } from "@clerk/clerk-react"; // Import useAuth
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const formatIncidentStatusDisplayName = (status: IncidentStatus): string => {
  switch (status) {
    case "investigating": return "Investigating";
    case "identified": return "Identified";
    case "monitoring": return "Monitoring";
    case "resolved": return "Resolved";
    default:
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
  }
};

export default function IncidentsPage() {
  const { incidents, isLoading, error, fetchIncidents, createIncident, updateIncident, addUpdate } =
    useIncidentStore()
  const { services, fetchServices: fetchServiceStoreServices, isLoading: servicesLoading } = useServiceStore()
  const { getToken, isLoaded: authIsLoaded } = useAuth(); // Get getToken

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAddUpdateDialogOpen, setIsAddUpdateDialogOpen] = useState(false)

  const [newIncidentTitle, setNewIncidentTitle] = useState("")
  const [newIncidentDescription, setNewIncidentDescription] = useState("")
  const [newIncidentStatus, setNewIncidentStatus] = useState<IncidentStatus>("investigating")
  const [newIncidentServiceIds, setNewIncidentServiceIds] = useState<string[]>([])

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [updateMessage, setUpdateMessage] = useState("")

  useEffect(() => {
    if (authIsLoaded && getToken) {
      fetchIncidents(getToken);
    }
    fetchServiceStoreServices();
  }, [fetchIncidents, fetchServiceStoreServices, getToken, authIsLoaded]);

  const handleCreateIncident = async () => {
    if (!newIncidentTitle.trim() || !newIncidentDescription.trim() || newIncidentServiceIds.length === 0) {
      toast.error("Error creating incident",{
        description: "Please fill in all required fields and select at least one service",
      })
      return
    }
    if (!getToken) {
        toast.error("Authentication Error", { description: "User token not available. Please sign in again." });
        return;
    }

    try {
        await createIncident(getToken, newIncidentTitle, newIncidentDescription, newIncidentStatus, newIncidentServiceIds)
        setNewIncidentTitle("")
        setNewIncidentDescription("")
        setNewIncidentStatus("investigating")
        setNewIncidentServiceIds([])
        setIsCreateDialogOpen(false)
        toast.success("Incident created successfully",{
        description: "You can now add updates to the incident",
        })
    } catch (e: any) {
        toast.error("Failed to create incident", { description: e.message || "An unknown error occurred." });
    }
  }

  const handleUpdateIncidentStatus = async (incident: Incident, newStatus: IncidentStatus) => {
    if (!getToken) {
        toast.error("Authentication Error", { description: "User token not available. Please sign in again." });
        return;
    }
    try {
        await updateIncident(getToken, incident.id, { status: newStatus })
        toast.success("Incident status updated successfully",{
        description: `Incident status updated to ${formatIncidentStatusDisplayName(newStatus)}`,
        })
    } catch (e: any) {
        toast.error("Failed to update incident status", { description: e.message || "An unknown error occurred." });
    }
  }

  const handleAddUpdate = async () => {
    if (!selectedIncident) {
      toast.error("Error adding update",{ description: "No incident selected." })
      return
    }
    if (!updateMessage.trim()) {
      toast.error("Error adding update",{ description: "Update message is required."})
      return
    }
    if (!getToken) {
        toast.error("Authentication Error", { description: "User token not available. Please sign in again." });
        return;
    }

    try {
        await addUpdate(getToken, selectedIncident.id, updateMessage)
        setUpdateMessage("")
        setIsAddUpdateDialogOpen(false)
        toast.success("Update added successfully")
    } catch (e: any) {
        toast.error("Failed to add update", { description: e.message || "An unknown error occurred." });
    }
  }

  const getIncidentStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case "investigating": return "bg-yellow-500";
      case "identified": return "bg-orange-500";
      case "monitoring": return "bg-blue-500";
      case "resolved": return "bg-green-500";
      default:
        const exhaustiveCheck: never = status;
        return exhaustiveCheck;
    }
  }

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");

  if (!authIsLoaded) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }


  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>Create Incident</Button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded my-4">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Active Incidents ({activeIncidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !incidents.length ? ( // Show main loader if loading and no incidents yet
            <div className="flex justify-center py-4">
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
                    <p className="text-sm mb-2 whitespace-pre-wrap">{incident.description}</p>
                    {incident.services && incident.services.length > 0 && (
                         <div className="mb-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Affected Services:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                            {incident.services.map((service) => (
                            <Badge key={service.id} variant="outline" className="text-xs">
                                {service.name}
                            </Badge>
                            ))}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {incident.status !== "resolved" && (
                        <>
                          {incident.status === "investigating" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateIncidentStatus(incident, "identified")}
                              disabled={isLoading}
                            >
                              Mark as Identified
                            </Button>
                          )}
                          {incident.status === "identified" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateIncidentStatus(incident, "monitoring")}
                              disabled={isLoading}
                            >
                              Mark as Monitoring
                            </Button>
                          )}
                          {incident.status === "monitoring" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateIncidentStatus(incident, "resolved")}
                              disabled={isLoading}
                            >
                              Mark as Resolved
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedIncident(incident)
                              setIsAddUpdateDialogOpen(true)
                            }}
                            disabled={isLoading}
                          >
                            Add Update
                          </Button>
                        </>
                      )}
                    </div>
                    {incident.updates && incident.updates.length > 0 && (
                      <div className="mt-4 border-t pt-4 dark:border-gray-700">
                        <h4 className="text-sm font-medium mb-2">Updates ({incident.updates.length})</h4>
                        <div className="space-y-3">
                          {[...incident.updates].reverse().map((update) => (
                            <div key={update.id} className="text-sm p-3 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-700">
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span className="font-medium">{format(new Date(update.createdAt), "MMM d, yyyy HH:mm")}</span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{update.message}</p>
                            </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Resolved Incidents ({resolvedIncidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !incidents.length ? (
             <div className="flex justify-center py-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : resolvedIncidents.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No resolved incidents.</p>
          ) : (
            <div className="space-y-4">
              {resolvedIncidents.map((incident) => (
                  <div key={incident.id} className="p-4 border rounded-md bg-gray-50/50 dark:bg-gray-800/50 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                      <div>
                        <h3 className="font-medium text-gray-700 dark:text-gray-300">{incident.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Created: {format(new Date(incident.createdAt), "PPP p")}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Resolved: {format(new Date(incident.updatedAt), "PPP p")}
                        </p>
                      </div>
                      <Badge className={`${getIncidentStatusColor(incident.status)} text-white`}>
                        {formatIncidentStatusDisplayName(incident.status)}
                      </Badge>
                    </div>
                    <p className="text-sm mb-2 text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{incident.description}</p>
                    {incident.services && incident.services.length > 0 && (
                        <div className="mb-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Affected Services:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                            {incident.services.map((service) => (
                            <Badge key={service.id} variant="outline" className="text-xs">
                                {service.name}
                            </Badge>
                            ))}
                            </div>
                        </div>
                    )}
                    {incident.updates && incident.updates.length > 0 && (
                      <div className="mt-4 border-t pt-4 dark:border-gray-700">
                        <h4 className="text-sm font-medium mb-2">Updates ({incident.updates.length})</h4>
                        <div className="space-y-3">
                          {[...incident.updates].reverse().map((update) => (
                            <div key={update.id} className="text-sm p-3 bg-white dark:bg-gray-700/50 rounded border dark:border-gray-600">
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span className="font-medium">{format(new Date(update.createdAt), "MMM d, yyyy HH:mm")}</span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{update.message}</p>
                            </div>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title*</Label>
              <Input
                id="title"
                value={newIncidentTitle}
                onChange={(e) => setNewIncidentTitle(e.target.value)}
                placeholder="e.g., API Outage, Database Slowdown"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description*</Label>
              <Textarea
                id="description"
                value={newIncidentDescription}
                onChange={(e) => setNewIncidentDescription(e.target.value)}
                placeholder="Detailed description of the incident, steps taken, impact..."
                rows={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Initial Status*</Label>
              <Select
                value={newIncidentStatus}
                onValueChange={(value) => setNewIncidentStatus(value as IncidentStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="identified">Identified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Affected Services*</Label>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2 dark:border-gray-700">
                {servicesLoading ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading services...</span>
                    </div>
                ) : services.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No services available. Please create services first.</p>
                ) : (
                  services.map((service: Service) => (
                    <div key={service.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`service-create-${service.id}`} // Ensure unique ID
                        checked={newIncidentServiceIds.includes(service.id)}
                        onCheckedChange={(checked) => {
                          setNewIncidentServiceIds((prevIds) =>
                            checked
                              ? [...prevIds, service.id]
                              : prevIds.filter((id) => id !== service.id)
                          )
                        }}
                      />
                      <Label htmlFor={`service-create-${service.id}`} className="text-sm font-normal cursor-pointer">
                        {service.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateIncident} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Incident
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedIncident && (
        <Dialog open={isAddUpdateDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setSelectedIncident(null); // Clear selected incident when dialog closes
                setUpdateMessage(""); // Clear message
            }
            setIsAddUpdateDialogOpen(isOpen);
        }}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Update to "{selectedIncident.title}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                <Label htmlFor="update-message">Update Message*</Label>
                <Textarea
                    id="update-message"
                    value={updateMessage}
                    onChange={(e) => setUpdateMessage(e.target.value)}
                    placeholder="Provide an update on the incident (e.g., progress, new findings, resolution steps)."
                    rows={5}
                />
                </div>
                <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {setIsAddUpdateDialogOpen(false); setUpdateMessage(""); setSelectedIncident(null);}}>
                    Cancel
                </Button>
                <Button onClick={handleAddUpdate} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Update
                </Button>
                </div>
            </div>
            </DialogContent>
        </Dialog>
      )}
    </div>
  )
}