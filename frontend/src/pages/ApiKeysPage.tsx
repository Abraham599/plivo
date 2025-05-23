"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {toast } from "sonner"
import { Copy, Key, Loader2, Trash } from "lucide-react"
import { format } from "date-fns"

interface ApiKey {
  id: string
  name: string
  isActive: boolean
  lastUsed: string | null
  createdAt: string
}

interface NewApiKey {
  id: string
  name: string
  key: string
  createdAt: string
}

export default function ApiKeysPage() {
  const { getToken } = useAuth()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewApiKey | null>(null)
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    setIsLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api-keys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch API keys")
      }

      const data = await response.json()
      setApiKeys(data)
    } catch (error) {
      console.error("Error fetching API keys:", error)
      toast("Error fetching API keys",{
        description: "Failed to load API keys",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast("API key name is required",{
        description: "Please enter a name for the API key",
      })
      return
    }

    setIsCreating(true)
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKeyName }),
      })

      if (!response.ok) {
        throw new Error("Failed to create API key")
      }

      const data = await response.json()
      setNewlyCreatedKey(data)
      setNewKeyName("")
      fetchApiKeys()
    } catch (error) {
      console.error("Error creating API key:", error)
      toast("Failed to create API key",{
        description: "Please try again",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteApiKey = async () => {
    if (!deletingKeyId) return

    setIsDeleting(true)
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api-keys/${deletingKeyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete API key")
      }

      toast("API key deleted successfully")

      setIsDeleteDialogOpen(false)
      setDeletingKeyId(null)
      fetchApiKeys()
    } catch (error) {
      console.error("Error deleting API key:", error)
      toast("Failed to delete API key",{
        description: "Please try again",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast("API key copied to clipboard",{
      description: "You can now use it in your API requests",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>Create API Key</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No API Keys</h3>
              <p className="text-gray-500 mb-4">Create an API key to access the Status Page API programmatically.</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>Create API Key</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex justify-between items-center p-4 border rounded-md">
                  <div>
                    <h3 className="font-medium flex items-center">
                      <Key className="h-4 w-4 mr-2 text-gray-500" />
                      {key.name}
                      {!key.isActive && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Created: {format(new Date(key.createdAt), "MMM d, yyyy")}
                      {key.lastUsed && ` • Last used: ${format(new Date(key.lastUsed), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingKeyId(key.id)
                        setIsDeleteDialogOpen(true)
                      }}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <p>
              Use the Status Page API to programmatically access your status page data. All API requests require an API
              key to be included in the request headers.
            </p>

            <h3 className="text-lg font-medium mt-4">Authentication</h3>
            <p>Include your API key in the X-API-Key header with all requests:</p>
            <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
              <code>X-API-Key: your-api-key</code>
            </pre>

            <h3 className="text-lg font-medium mt-4">Endpoints</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <code className="bg-gray-100 px-1 rounded">GET /api/v1/status</code> - Get a summary of all services and
                their current status
              </li>
              <li>
                <code className="bg-gray-100 px-1 rounded">GET /api/v1/services</code> - List all services
              </li>
              <li>
                <code className="bg-gray-100 px-1 rounded">GET /api/v1/services/{"{service_id}"}</code> - Get details
                for a specific service
              </li>
              <li>
                <code className="bg-gray-100 px-1 rounded">GET /api/v1/incidents</code> - List incidents (optional query
                param: status)
              </li>
              <li>
                <code className="bg-gray-100 px-1 rounded">GET /api/v1/incidents/{"{incident_id}"}</code> - Get details
                for a specific incident
              </li>
              <li>
                <code className="bg-gray-100 px-1 rounded">GET /api/v1/uptime/{"{service_id}"}</code> - Get uptime
                metrics for a service
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4">Example</h3>
            <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
              <code>
                {`curl -X GET \\
  "${window.location.origin}/api/v1/status" \\
  -H "X-API-Key: your-api-key"`}
              </code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newlyCreatedKey ? "API Key Created" : "Create API Key"}</DialogTitle>
          </DialogHeader>
          {newlyCreatedKey ? (
            <div className="py-4 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                <p className="text-yellow-800 text-sm font-medium mb-2">
                  Important: This key will only be shown once. Please copy it now.
                </p>
                <div className="flex items-center space-x-2">
                  <Input
                    value={newlyCreatedKey.key}
                    readOnly
                    className="font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(newlyCreatedKey.key)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Name</p>
                <p className="font-medium">{newlyCreatedKey.name}</p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => {
                    setNewlyCreatedKey(null)
                    setIsCreateDialogOpen(false)
                  }}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">API Key Name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production, Development, Monitoring"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateApiKey} disabled={isCreating}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isCreating ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete API Key Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this API key? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteApiKey} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
