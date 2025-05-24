from clerk_backend_api import Clerk
from clerk_backend_api.models.organization import Organization as ClerkOrganization
from clerk_backend_api.models.user import User as ClerkUser
from clerk_backend_api.models import OrganizationMembership
from typing import List, Optional, Dict, Any
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ClerkService:
    def __init__(self, clerk_client: Clerk):
        self.clerk = clerk_client
    
    async def create_organization(self, name: str, slug: Optional[str] = None) -> ClerkOrganization:
        """
        Create a new organization in Clerk
        
        Args:
            name: The name of the organization
            slug: Optional slug for the organization URL
            
        Returns:
            The created organization object
        """
        try:
            # Create organization in Clerk with the correct parameters
            # The API expects a dictionary with the organization data
            organization_data = {}
            if name:
                organization_data["name"] = name
            if slug:
                organization_data["slug"] = slug
                
            # Create the organization using the correct method
            organization = self.clerk.organizations.create_organization(organization_data)
            logger.info(f"Created organization in Clerk: {organization.id} - {name}")
            return organization
        except Exception as e:
            logger.error(f"Error creating organization in Clerk: {e}")
            raise
            
    async def delete_organization(self, organization_id: str) -> None:
        """
        Delete an organization from Clerk
        
        Args:
            organization_id: The Clerk organization ID
        """
        try:
            # Delete the organization
            self.clerk.organizations.delete_organization(organization_id)
            logger.info(f"Deleted organization from Clerk: {organization_id}")
        except Exception as e:
            logger.error(f"Error deleting organization from Clerk: {e}")
            raise
    
    async def add_user_to_organization(
        self, 
        user_id: str, 
        organization_id: str, 
        role: str = "admin"
    ) -> OrganizationMembership:
        """
        Add a user to an organization in Clerk
        
        Args:
            user_id: The Clerk user ID
            organization_id: The Clerk organization ID
            role: The role of the user in the organization
            
        Returns:
            The created organization membership
        """
        try:
            # Add user to organization
            membership = self.clerk.organization_memberships.create(
                organization_id=organization_id,
                user_id=user_id,
                role=role
            )
            logger.info(f"Added user {user_id} to organization {organization_id} with role {role}")
            return membership
        except Exception as e:
            logger.error(f"Error adding user to organization: {e}")
            raise
    
    async def get_user_organizations(self, user_id: str) -> List[OrganizationMembership]:
        """
        Get all organizations that a user is a member of
        
        Args:
            user_id: The Clerk user ID
            
        Returns:
            List of organization memberships
        """
        try:
            # Get user's organization memberships
            memberships = self.clerk.users.get_organization_memberships(user_id=user_id)
            
            # Convert to a list if it's not already
            if not isinstance(memberships, list):
                # Handle the case where memberships might be a custom object
                # that doesn't support len() directly
                memberships_list = []
                # Try to iterate through the memberships object
                try:
                    for membership in memberships:
                        memberships_list.append(membership)
                    return memberships_list
                except Exception as iter_error:
                    logger.error(f"Error iterating through memberships: {iter_error}")
                    # If we can't iterate, return an empty list
                    return []
            return memberships
        except Exception as e:
            logger.error(f"Error getting user organizations: {e}")
            return []  # Return empty list instead of raising to avoid breaking the flow
    
    async def get_organization(self, organization_id: str) -> ClerkOrganization:
        """
        Get an organization by ID
        
        Args:
            organization_id: The Clerk organization ID
            
        Returns:
            The organization object
        """
        try:
            # Get organization details
            organization = self.clerk.organizations.get(organization_id=organization_id)
            return organization
        except Exception as e:
            logger.error(f"Error getting organization {organization_id}: {e}")
            raise
    
    async def update_organization(
        self, 
        organization_id: str, 
        name: Optional[str] = None,
        slug: Optional[str] = None
    ) -> ClerkOrganization:
        """
        Update an organization in Clerk
        
        Args:
            organization_id: The Clerk organization ID
            name: Optional new name for the organization
            slug: Optional new slug for the organization
            
        Returns:
            The updated organization object
        """
        try:
            # Build update data
            update_data = {}
            if name is not None:
                update_data["name"] = name
            if slug is not None:
                update_data["slug"] = slug
                
            # Update organization
            organization = self.clerk.organizations.update(
                organization_id=organization_id,
                **update_data
            )
            logger.info(f"Updated organization {organization_id}")
            return organization
        except Exception as e:
            logger.error(f"Error updating organization {organization_id}: {e}")
            raise
    
    async def delete_organization(self, organization_id: str) -> None:
        """
        Delete an organization in Clerk
        
        Args:
            organization_id: The Clerk organization ID
        """
        try:
            # Delete organization
            self.clerk.organizations.delete(organization_id=organization_id)
            logger.info(f"Deleted organization {organization_id}")
        except Exception as e:
            logger.error(f"Error deleting organization {organization_id}: {e}")
            raise
    
    async def update_organization_membership(
        self,
        organization_id: str,
        user_id: str,
        role: str
    ) -> OrganizationMembership:
        """
        Update a user's role in an organization
        
        Args:
            organization_id: The Clerk organization ID
            user_id: The Clerk user ID
            role: The new role for the user
            
        Returns:
            The updated organization membership
        """
        try:
            # Get the membership ID first
            memberships = self.clerk.users.get_organization_memberships(user_id=user_id)
            membership = next((m for m in memberships if m.organization.id == organization_id), None)
            
            if not membership:
                raise ValueError(f"User {user_id} is not a member of organization {organization_id}")
            
            # Update membership
            updated_membership = self.clerk.organization_memberships.update(
                organization_membership_id=membership.id,
                role=role
            )
            logger.info(f"Updated role for user {user_id} in organization {organization_id} to {role}")
            return updated_membership
        except Exception as e:
            logger.error(f"Error updating organization membership: {e}")
            raise
    
    async def remove_user_from_organization(self, organization_id: str, user_id: str) -> None:
        """
        Remove a user from an organization
        
        Args:
            organization_id: The Clerk organization ID
            user_id: The Clerk user ID
        """
        try:
            # Get the membership ID first
            memberships = self.clerk.users.get_organization_memberships(user_id=user_id)
            membership = next((m for m in memberships if m.organization.id == organization_id), None)
            
            if not membership:
                raise ValueError(f"User {user_id} is not a member of organization {organization_id}")
            
            # Delete membership
            self.clerk.organization_memberships.delete(organization_membership_id=membership.id)
            logger.info(f"Removed user {user_id} from organization {organization_id}")
        except Exception as e:
            logger.error(f"Error removing user from organization: {e}")
            raise
