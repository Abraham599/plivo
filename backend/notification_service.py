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
    
    async def get_organization_users(self, organization_id: str):
        """Get all users for an organization with their notification preferences."""
        users = await self.db.user.find_many(
            where={"organization_id": organization_id},
            include={"NotificationPreferences": True}
        )
        return users
    
    async def send_service_status_change_notification(self, service_id: str, old_status: str, new_status: str):
        """Send email notifications for service status changes."""
        service = await self.db.service.find_unique(
            where={"id": service_id},
            include={"organization": True}
        )
        print(service)
        if not service:
            return
        
        users = await self.get_organization_users(service.organization_id)
        print(users)
        # Filter users who want service status change notifications
        recipients = [
            user.email for user in users 
            if user.notificationPreferences and user.notificationPreferences.serviceStatusChanges
        ]
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
        
        users = await self.get_organization_users(incident.organization_id)
        
        # Filter users who want new incident notifications
        recipients = [
            user.email for user in users 
            if user.notificationPreferences and user.notificationPreferences.newIncidents
        ]
        
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
        
        users = await self.get_organization_users(update.incident.organization_id)
        
        # Filter users who want incident update notifications
        recipients = [
            user.email for user in users 
            if user.notificationPreferences and user.notificationPreferences.incidentUpdates
        ]
        
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
        
        users = await self.get_organization_users(incident.organization_id)
        
        # Filter users who want incident resolved notifications
        recipients = [
            user.email for user in users 
            if user.notificationPreferences and user.notificationPreferences.incidentResolved
        ]
        
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
