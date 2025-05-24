"use client"

import { useState } from "react"
import { useAuth, useOrganization } from "@clerk/clerk-react"
import { useOrganizationStore } from "../stores/organizationStore"
import { toast } from "sonner"
import type { Organization } from "../api/userApi"

export function OrganizationManager() {
  const { getToken } = useAuth()
  const { organization: clerkOrg } = useOrganization()
  const { 
    currentOrganization, 
    organizations, 
    createNewOrganization, 
    switchToOrganization,
    isLoading
  } = useOrganizationStore()
  
  const [newOrgName, setNewOrgName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newOrgName.trim()) {
      toast.error("Organization name is required")
      return
    }
    
    setIsCreating(true)
    
    try {
      const token = await getToken()
      if (!token) {
        toast.error("Authentication error", { 
          description: "Please sign in again" 
        })
        return
      }
      
      await createNewOrganization(newOrgName, token)
      toast.success("Organization created successfully")
      setNewOrgName("")
      setShowCreateForm(false)
    } catch (error) {
      console.error("Error creating organization:", error)
      toast.error("Failed to create organization", { 
        description: error instanceof Error ? error.message : "An unknown error occurred" 
      })
    } finally {
      setIsCreating(false)
    }
  }
  
  const handleSwitchOrganization = async (org: Organization) => {
    if (org.id === currentOrganization?.id) return
    
    try {
      const token = await getToken()
      if (!token) {
        toast.error("Authentication error", { 
          description: "Please sign in again" 
        })
        return
      }
      
      await switchToOrganization(org.id, token)
      
      // Also switch the organization in Clerk
      if (clerkOrg?.id !== org.clerk_org_id) {
        // This will trigger a page reload and the UserInitializer will handle syncing
        window.location.href = `/organization/${org.clerk_org_id}`
      }
      
      toast.success(`Switched to ${org.name}`)
    } catch (error) {
      console.error("Error switching organization:", error)
      toast.error("Failed to switch organization", { 
        description: error instanceof Error ? error.message : "An unknown error occurred" 
      })
    }
  }
  
  if (!organizations || organizations.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-2">No Organizations</h3>
        <p className="text-gray-600 mb-4">You don't have any organizations yet.</p>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={isLoading}
        >
          Create Organization
        </button>
        
        {showCreateForm && (
          <form onSubmit={handleCreateOrganization} className="mt-4">
            <div className="mb-4">
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter organization name"
                disabled={isCreating}
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                disabled={isCreating}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Your Organizations</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreateForm ? "Cancel" : "New Organization"}
        </button>
      </div>
      
      {showCreateForm && (
        <form onSubmit={handleCreateOrganization} className="mb-4 p-3 border border-gray-200 rounded">
          <div className="mb-3">
            <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter organization name"
              disabled={isCreating}
              required
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create Organization"}
          </button>
        </form>
      )}
      
      <ul className="space-y-2">
        {organizations.map((org) => (
          <li 
            key={org.id} 
            className={`p-3 border rounded cursor-pointer transition-colors ${
              currentOrganization?.id === org.id 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-200 hover:bg-gray-100"
            }`}
            onClick={() => handleSwitchOrganization(org)}
          >
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">{org.name}</h4>
                {org.clerk_details?.role && (
                  <span className="text-xs text-gray-500">
                    Role: {org.clerk_details.role}
                  </span>
                )}
              </div>
              {currentOrganization?.id === org.id && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Current
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
