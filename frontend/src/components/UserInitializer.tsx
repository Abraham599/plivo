"use client"

import { useEffect } from "react"
import { useAuth, useUser, useOrganization } from "@clerk/clerk-react"
import { useOrganizationStore } from "../stores/organizationStore"

export function UserInitializer() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { organization: storeOrg } = useOrganizationStore()

  useEffect(() => {
    const initializeUser = async () => {
      if (!user || !organization || !storeOrg) return

      try {
        const token = await getToken()
        await fetch(`${import.meta.env.VITE_API_URL}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName,
            organization_id: storeOrg.id,
          }),
        })
      } catch (error) {
        console.error("Error initializing user:", error)
      }
    }

    initializeUser()
  }, [user, organization, storeOrg, getToken])

  return null
}
