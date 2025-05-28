import os
import resend
from templates.email_templates import (
    render_service_status_change_email,
    render_new_incident_email,
    render_incident_update_email,
    render_incident_resolved_email
)
from prisma import Prisma

# Initialize Resend with API key
resend.api_key = os.getenv("RESEND_API_KEY")

class NotificationService:
    def __init__(self, db: Prisma):
        self.db = db
    
    async def get_user_with_preferences(self, user_id: str):
        """Get a user with their notification preferences."""
        user = await self.db.user.find_unique(
            where={"id": user_id},
            include={"notificationPreferences": True}
        )
        return user
    
    async def send_service_status_change_notification(self, service_id: str, old_status: str, new_status: str):
        """Send email notifications for service status changes."""
        service = await self.db.service.find_unique(
            where={"id": service_id},
            include={"organization": True}
        )
        print(service)
        if not service:
            return
        
        # Get the user who owns the service
        user = await self.get_user_with_preferences(service.organization.user_id)
        # Check if user wants service status change notifications
        recipients = [user.email] if (user and user.notificationPreferences 
                                   and user.notificationPreferences.serviceStatusChanges) else []
        print(recipients)
        
        if not recipients:
            return
        
        html_content = render_service_status_change_email(
            service_name=service.name,
            old_status=old_status,
            new_status=new_status,
            organization_name=service.organization.name
        )
        
        try:
            resend.Emails.send({
                "from": f"Status Page <notifications@{os.getenv('RESEND_DOMAIN', 'example.com')}>",
                "to": recipients,
                "subject": f"Service Status Change: {service.name}",
                "html": html_content
            })
        except Exception as e:
            print(f"Error sending service status change email: {e}")
    
    async def send_new_incident_notification(self, incident_id: str):
        """Send email notifications for new incidents."""
        incident = await self.db.incident.find_unique(
            where={"id": incident_id},
            include={"services": True, "organization": True}
        )
        
        if not incident:
            return
        
        # Get the user who owns the organization
        user = await self.get_user_with_preferences(incident.organization.user_id)
        # Check if user wants new incident notifications
        recipients = [user.email] if (user and user.notificationPreferences 
                                   and user.notificationPreferences.newIncidents) else []
        
        if not recipients:
            return
        
        html_content = render_new_incident_email(
            incident_title=incident.title,
            incident_description=incident.description,
            services=incident.services,
            organization_name=incident.organization.name
        )
        
        try:
            resend.Emails.send({
                "from": f"Status Page <notifications@{os.getenv('RESEND_DOMAIN', 'example.com')}>",
                "to": recipients,
                "subject": f"New Incident: {incident.title}",
                "html": html_content
            })
        except Exception as e:
            print(f"Error sending new incident email: {e}")
    
    async def send_incident_update_notification(self, update_id: str):
        """Send email notifications for incident updates."""
        update = await self.db.update.find_unique(
            where={"id": update_id},
            include={"incident": {"include": {"organization": True}}}
        )
        
        if not update or not update.incident:
            return
        
        # Get the user who owns the organization
        user = await self.get_user_with_preferences(update.incident.organization.user_id)
        # Check if user wants incident update notifications
        recipients = [user.email] if (user and user.notificationPreferences 
                                   and user.notificationPreferences.incidentUpdates) else []
        
        if not recipients:
            return
        
        html_content = render_incident_update_email(
            incident_title=update.incident.title,
            update_message=update.message,
            organization_name=update.incident.organization.name
        )
        
        try:
            resend.Emails.send({
                "from": f"Status Page <notifications@{os.getenv('RESEND_DOMAIN', 'example.com')}>",
                "to": recipients,
                "subject": f"Incident Update: {update.incident.title}",
                "html": html_content
            })
        except Exception as e:
            print(f"Error sending incident update email: {e}")
    
    async def send_incident_resolved_notification(self, incident_id: str):
        """Send email notifications when incidents are resolved."""
        incident = await self.db.incident.find_unique(
            where={"id": incident_id},
            include={"organization": True}
        )
        
        if not incident:
            return
        
        # Get the user who owns the organization
        user = await self.get_user_with_preferences(incident.organization.user_id)
        # Check if user wants incident resolved notifications
        recipients = [user.email] if (user and user.notificationPreferences 
                                   and user.notificationPreferences.incidentResolved) else []
        
        if not recipients:
            return
        
        html_content = render_incident_resolved_email(
            incident_title=incident.title,
            organization_name=incident.organization.name
        )
        
        try:
            resend.Emails.send({
                "from": f"Status Page <notifications@{os.getenv('RESEND_DOMAIN', 'example.com')}>",
                "to": recipients,
                "subject": f"Incident Resolved: {incident.title}",
                "html": html_content
            })
        except Exception as e:
            print(f"Error sending incident resolved email: {e}")
