"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser, useOrganization } from "@clerk/clerk-react"
import { useOrganizationStore } from "../stores/organizationStore"
import { ensureUserSynced } from "../api/userApi"
import { toast } from "sonner"

export function UserInitializer() {
  const { getToken } = useAuth()
  const { user, isLoaded: isUserLoaded } = useUser()
  const { organization, isLoaded: isOrgLoaded } = useOrganization()
  const { 
    currentOrganization, 
    fetchOrganizations, 
    setCurrentOrganization 
  } = useOrganizationStore()
  
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize user and organizations when Clerk user is loaded
  useEffect(() => {
    const initializeUser = async () => {
      if (!isUserLoaded || !user) return
      
      try {
        // Get token for API authentication
        const token = await getToken()
        if (!token) return
        
        // Ensure user is synced with our backend
        const syncedUser = await ensureUserSynced(token)
        console.log("User synced with backend:", syncedUser)
        
        // Fetch all organizations the user is a member of
        const organizations = await fetchOrganizations(token)
        console.log("User organizations:", organizations)
        
        setIsInitialized(true)
      } catch (error) {
        console.error("Error initializing user:", error)
        toast.error("Error initializing user", {
          description: error instanceof Error ? error.message : "Failed to initialize user"
        })
      }
    }

    if (isUserLoaded && user && !isInitialized) {
      initializeUser()
    }
  }, [isUserLoaded, user, getToken, fetchOrganizations, isInitialized])
  
  // Update current organization when Clerk organization changes
  useEffect(() => {
    const syncOrganization = async () => {
      if (!isOrgLoaded || !organization || !currentOrganization) return
      
      // If the Clerk organization ID doesn't match our current organization's clerk_org_id,
      // we need to switch to the corresponding organization in our state
      if (organization.id !== currentOrganization.clerk_org_id) {
        try {
          const token = await getToken()
          if (!token) return
          
          // Fetch all organizations to make sure we have the latest data
          const organizations = await fetchOrganizations(token)
          
          // Find the organization that matches the Clerk organization ID
          const matchingOrg = organizations.find(org => org.clerk_org_id === organization.id)
          if (matchingOrg) {
            setCurrentOrganization(matchingOrg)
          }
        } catch (error) {
          console.error("Error syncing organization:", error)
        }
      }
    }
    
    syncOrganization()
  }, [isOrgLoaded, organization, currentOrganization, getToken, fetchOrganizations, setCurrentOrganization])

  return null
}
