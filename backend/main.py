import os
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any, Annotated
import asyncio
import json
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
# Change this import
from prisma import Prisma
from notification_service import NotificationService
from uptime_service import UptimeService
from api_auth import ApiKeyAuth
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import AuthenticateRequestOptions
from clerk_backend_api.models.user import User as ClerkUserType
import subprocess
import sys

app = FastAPI(title="Status Page API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Initialize Prisma client
db = Prisma(auto_register=True)

# Initialize services after Prisma client
notification_service = NotificationService(db)
uptime_service = UptimeService(db)
api_key_auth = ApiKeyAuth(db)

# Initialize Clerk SDK
clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))

@app.on_event("startup")
async def startup():
    # Try to fetch Prisma binaries if needed
    try:
        subprocess.run(["prisma", "py", "fetch"], check=True)
        print("✅ Prisma binaries fetched successfully")
    except Exception as e:
        print(f"⚠️ Warning: Failed to fetch Prisma binaries: {e}")
    
    # Try to generate Prisma client if needed
    try:
        subprocess.run(["prisma", "generate"], check=True)
        print("✅ Prisma client generated successfully")
    except Exception as e:
        print(f"⚠️ Warning: Failed to generate Prisma client: {e}")
    
    # Connect to the database
    try:
        await db.connect()
        print("✅ Connected to database successfully")
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        # Don't exit here, just log the error
        # sys.exit(1)
    
    # Start uptime monitoring in the background
    try:
        asyncio.create_task(uptime_service.start_monitoring())
        print("✅ Started uptime monitoring")
    except Exception as e:
        print(f"⚠️ Warning: Failed to start uptime monitoring: {e}")

@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()

# Clerk authentication dependency
async def get_clerk_user(request: Request, authorization: Annotated[Optional[str], Header()] = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract the token from the Authorization header
        token = authorization.replace("Bearer ", "")
        
        # Authenticate the request (fix: pass token as kwarg in options)
        request_state = clerk.authenticate_request(
            request,
            AuthenticateRequestOptions(
                # You can specify authorized parties if needed
                # authorized_parties=["your-domain.com"],
                token=token
            )
        )
        
        if not request_state.is_signed_in:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Return the user data
        return request_state.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

async def get_clerk_user_payload(request: Request, authorization: Annotated[Optional[str], Header()] = None) -> ClerkUserType:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    try:
        token = authorization.replace("Bearer ", "")
        request_state = clerk.authenticate_request(
            request, AuthenticateRequestOptions(token=token)
        )
        if not request_state.is_signed_in or not request_state.user:
            raise HTTPException(status_code=401, detail="Not authenticated or user data missing")
        return request_state.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# Models
class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: str
    endpoint: Optional[str] = None

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    endpoint: Optional[str] = None

class IncidentCreate(BaseModel):
    title: str
    description: str
    status: str
    service_ids: List[str]
    organization_id: str

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    service_ids: Optional[List[str]] = None

class UpdateCreate(BaseModel):
    message: str
    incident_id: str

class OrganizationCreate(BaseModel):
    name: str
    clerk_org_id: str

class ApiKeyCreate(BaseModel):
    name: str

# Routes
@app.get("/")
async def root():
    return {"message": "Status Page API"}

# Organization routes
@app.post("/organizations")
async def create_organization(org: OrganizationCreate):
    created_org = await db.organization.create(
        data={
            "name": org.name,
            "clerk_org_id": org.clerk_org_id,
        }
    )
    return created_org

@app.get("/organizations/{clerk_org_id}")
async def get_organization(clerk_org_id: str):
    org = await db.organization.find_first(
        where={"clerk_org_id": clerk_org_id}
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

# Service routes
@app.post("/services")
async def create_service(service: ServiceCreate, user: Annotated[Any, Depends(get_clerk_user)]):
    created_service = await db.service.create(
        data={
            "name": service.name,
            "description": service.description,
            "status": "operational",
            "endpoint": service.endpoint,
            "organization": {
                "connect": {"id": service.organization_id}
            }
        }
    )
    await manager.broadcast(json.dumps({
        "type": "service_created",
        "data": {
            "id": created_service.id,
            "name": created_service.name,
            "status": created_service.status
        }
    }))
    return created_service

@app.get("/services")
async def get_services(organization_id: Optional[str] = None):
    where = {"organization_id": organization_id} if organization_id else {}
    services = await db.service.find_many(where=where)
    return services

@app.get("/services/{service_id}")
async def get_service(service_id: str):
    service = await db.service.find_unique(where={"id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@app.put("/services/{service_id}")
async def update_service(service_id: str, service_update: ServiceUpdate, user: Annotated[Any, Depends(get_clerk_user)]):
    # Get the current service to compare status
    current_service = await db.service.find_unique(where={"id": service_id})
    if not current_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    old_status = current_service.status
    
    # Convert to dict and exclude unset values
    updated_data = {k: v for k, v in service_update.model_dump().items() if v is not None}
    
    service = await db.service.update(
        where={"id": service_id},
        data=updated_data
    )
    
    # If status has changed, send notification
    if service_update.status and service_update.status != old_status:
        await notification_service.send_service_status_change_notification(
            service_id=service_id,
            old_status=old_status,
            new_status=service_update.status
        )
    
    if service_update.status:
        await manager.broadcast(json.dumps({
            "type": "service_updated",
            "data": {
                "id": service.id,
                "name": service.name,
                "status": service.status
            }
        }))
    return service

@app.delete("/services/{service_id}")
async def delete_service(service_id: str, user: Annotated[Any, Depends(get_clerk_user)]):
    await db.service.delete(where={"id": service_id})
    await manager.broadcast(json.dumps({
        "type": "service_deleted",
        "data": {"id": service_id}
    }))
    return {"message": "Service deleted"}

# Incident routes
@app.post("/incidents")
async def create_incident(incident: IncidentCreate, user: Annotated[Any, Depends(get_clerk_user)]):
    created_incident = await db.incident.create(
        data={
            "title": incident.title,
            "description": incident.description,
            "status": incident.status,
            "services": {
                "connect": [{"id": service_id} for service_id in incident.service_ids]
            },
            "organization": {
                "connect": {"id": incident.organization_id}
            }
        }
    )
    
    # Update service statuses based on incident status
    for service_id in incident.service_ids:
        service = await db.service.find_unique(where={"id": service_id})
        if service and service.status != incident.status:
            await db.service.update(
                where={"id": service_id},
                data={"status": incident.status}
            )
            # Send notification for service status change
            await notification_service.send_service_status_change_notification(
                service_id=service_id,
                old_status=service.status,
                new_status=incident.status
            )
    
    # Send notification for new incident
    await notification_service.send_new_incident_notification(incident_id=created_incident.id)
    
    await manager.broadcast(json.dumps({
        "type": "incident_created",
        "data": {
            "id": created_incident.id,
            "title": created_incident.title,
            "status": created_incident.status,
            "service_ids": incident.service_ids
        }
    }))
    return created_incident

@app.get("/incidents")
async def get_incidents(organization_id: Optional[str] = None, status: Optional[str] = None):
    where = {}
    if organization_id:
        where["organization_id"] = organization_id
    if status:
        where["status"] = status
    
    incidents = await db.incident.find_many(
        where=where,
        include={"services": True, "updates": True}
    )
    return incidents

@app.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    incident = await db.incident.find_unique(
        where={"id": incident_id},
        include={"services": True, "updates": True}
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.put("/incidents/{incident_id}")
async def update_incident(incident_id: str, incident_update: IncidentUpdate, user: Annotated[Any, Depends(get_clerk_user)]):
    # Convert to dict and exclude unset values
    updated_data = {k: v for k, v in incident_update.model_dump().items() if v is not None}
    
    # Handle service connections separately
    service_ids = updated_data.pop("service_ids", None)
    
    # Get current incident status
    current_incident = await db.incident.find_unique(where={"id": incident_id})
    if not current_incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    old_status = current_incident.status
    
    incident = await db.incident.update(
        where={"id": incident_id},
        data=updated_data
    )
    
    if service_ids:
        # Update the services connected to this incident
        await db.incident.update(
            where={"id": incident_id},
            data={
                "services": {
                    "set": [{"id": service_id} for service_id in service_ids]
                }
            }
        )
        
        # Update service statuses based on incident status
        if incident_update.status:
            for service_id in service_ids:
                service = await db.service.find_unique(where={"id": service_id})
                if service and service.status != incident_update.status:
                    await db.service.update(
                        where={"id": service_id},
                        data={"status": incident_update.status}
                    )
                    # Send notification for service status change
                    await notification_service.send_service_status_change_notification(
                        service_id=service_id,
                        old_status=service.status,
                        new_status=incident_update.status
                    )
    
    # If incident was resolved, send resolved notification
    if incident_update.status and incident_update.status == "resolved" and old_status != "resolved":
        await notification_service.send_incident_resolved_notification(incident_id=incident_id)
    
    await manager.broadcast(json.dumps({
        "type": "incident_updated",
        "data": {
            "id": incident.id,
            "title": incident.title,
            "status": incident.status,
            "service_ids": service_ids
        }
    }))
    return incident

@app.delete("/incidents/{incident_id}")
async def delete_incident(incident_id: str, user: Annotated[Any, Depends(get_clerk_user)]):
    await db.incident.delete(where={"id": incident_id})
    await manager.broadcast(json.dumps({
        "type": "incident_deleted",
        "data": {"id": incident_id}
    }))
    return {"message": "Incident deleted"}

# Update routes
@app.post("/updates")
async def create_update(update: UpdateCreate, user: Annotated[Any, Depends(get_clerk_user)]):
    created_update = await db.update.create(
        data={
            "message": update.message,
            "incident": {
                "connect": {"id": update.incident_id}
            }
        }
    )
    
    # Send notification for incident update
    await notification_service.send_incident_update_notification(update_id=created_update.id)
    
    await manager.broadcast(json.dumps({
        "type": "update_created",
        "data": {
            "id": created_update.id,
            "message": created_update.message,
            "incident_id": update.incident_id
        }
    }))
    return created_update

@app.get("/updates")
async def get_updates(incident_id: Optional[str] = None):
    where = {"incident_id": incident_id} if incident_id else {}
    updates = await db.update.find_many(where=where)
    return updates

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Add new routes for user management and notification preferences
class UserCreate(BaseModel):
    email: str
    name: Optional[str] = None
    organization_id: str

class SyncedUserResponse(BaseModel):
    id: str
    clerk_user_id: str
    email: str
    name: Optional[str] = None
    organization_id: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        populate_by_name = True


class NotificationPreferenceUpdate(BaseModel):
    serviceStatusChanges: Optional[bool] = None
    newIncidents: Optional[bool] = None
    incidentUpdates: Optional[bool] = None
    incidentResolved: Optional[bool] = None

@app.post("/api/users/ensure-synced", response_model=SyncedUserResponse)
async def ensure_user_synced(clerk_user_payload: Annotated[ClerkUserType, Depends(get_clerk_user_payload)]):
    clerk_id = clerk_user_payload.id
    
    primary_email_obj = None
    if clerk_user_payload.primary_email_address_id and clerk_user_payload.email_addresses:
        primary_email_obj = next(
            (em for em in clerk_user_payload.email_addresses if em.id == clerk_user_payload.primary_email_address_id),
            None
        )
    
    if not primary_email_obj:
        # Fallback if primary_email_address_id is not set, try first verified email
        if clerk_user_payload.email_addresses:
            primary_email_obj = next(
                (em for em in clerk_user_payload.email_addresses if em.verification and em.verification.status == 'verified'),
                clerk_user_payload.email_addresses[0] if clerk_user_payload.email_addresses else None
            )
        if not primary_email_obj:
             raise HTTPException(status_code=400, detail="Primary or verified email not found for Clerk user.")

    email = primary_email_obj.email_address
    
    name = None
    if clerk_user_payload.first_name and clerk_user_payload.last_name:
        name = f"{clerk_user_payload.first_name} {clerk_user_payload.last_name}".strip()
    elif clerk_user_payload.first_name:
        name = clerk_user_payload.first_name
    elif clerk_user_payload.username: # Fallback to username
        name = clerk_user_payload.username


    db_user = await db.user.find_unique(where={"clerk_user_id": clerk_id})

    if db_user:
        updated_data = {}
        if name and db_user.name != name:
            updated_data["name"] = name
        if email and db_user.email != email: # Email might change in Clerk
            updated_data["email"] = email
        
        if updated_data:
            db_user = await db.user.update(where={"clerk_user_id": clerk_id}, data=updated_data)
        
        return SyncedUserResponse(
            id=db_user.id,
            clerk_user_id=db_user.clerk_user_id,
            email=db_user.email,
            name=db_user.name,
            organization_id=db_user.organization_id,
            createdAt=db_user.createdAt, # Prisma uses createdAt
            updatedAt=db_user.updatedAt, # Prisma uses updatedAt
        )

    # User not found, create them
    local_org_id_to_link = None
    
    # Check Clerk organization memberships
    if clerk_user_payload.organization_memberships and len(clerk_user_payload.organization_memberships) > 0:
        # Assuming the first organization membership is the relevant one
        # You might need more sophisticated logic if a user can be in multiple Clerk orgs
        # and you need to pick a specific one to be their "primary" in your app.
        clerk_org_details = clerk_user_payload.organization_memberships[0].organization
        clerk_org_id_from_member = clerk_org_details.id
        org_name_from_clerk = clerk_org_details.name or f"{name}'s Organization"

        local_org = await db.organization.find_unique(where={"clerk_org_id": clerk_org_id_from_member})
        if not local_org:
            local_org = await db.organization.create(
                data={"name": org_name_from_clerk, "clerk_org_id": clerk_org_id_from_member}
            )
        local_org_id_to_link = local_org.id
    else:
        # No Clerk organization, create a personal one
        personal_clerk_org_id = f"personal_{clerk_id}" # Unique identifier for this personal org
        personal_org_name = f"{name}'s Workspace" if name else f"{email.split('@')[0]}'s Workspace"
        
        existing_personal_org = await db.organization.find_unique(where={"clerk_org_id": personal_clerk_org_id})
        if existing_personal_org:
            local_org_id_to_link = existing_personal_org.id
        else:
            new_personal_org = await db.organization.create(
                data={"name": personal_org_name, "clerk_org_id": personal_clerk_org_id}
            )
            local_org_id_to_link = new_personal_org.id

    if not local_org_id_to_link:
        raise HTTPException(status_code=500, detail="Failed to determine or create organization for the user.")

    created_user = await db.user.create(
        data={
            "clerk_user_id": clerk_id,
            "email": email,
            "name": name,
            "organization_id": local_org_id_to_link,
            "notificationPreferences": {
                "create": {
                    "serviceStatusChanges": True,
                    "newIncidents": True,
                    "incidentUpdates": True,
                    "incidentResolved": True
                }
            }
        },
        include={"organization": True} # To ensure organization_id is populated correctly
    )
    
    return SyncedUserResponse(
        id=created_user.id,
        clerk_user_id=created_user.clerk_user_id,
        email=created_user.email,
        name=created_user.name,
        organization_id=created_user.organization_id, # This comes directly from created_user now
        createdAt=created_user.createdAt,
        updatedAt=created_user.updatedAt,
    )


@app.post("/users")
async def create_user(user: UserCreate, clerk_auth_user: Annotated[Any, Depends(get_clerk_user_payload)]):
    # Check if user already exists
    existing_user = await db.user.find_first(
        where={"email": user.email}
    )
    
    if existing_user:
        return existing_user
    
    target_org = await db.organization.find_unique(where={"id": clerk_auth_user.organization_id})
    if not target_org:
        raise HTTPException(status_code=404, detail=f"Organization with ID {clerk_auth_user.organization_id} not found.")
    
    # Create new user
    created_user = await db.user.create(
        data={
            "clerk_user_id": clerk_auth_user.id, # Link to the authenticated Clerk user
            "email": clerk_auth_user.email, # Should match clerk_auth_user's email
            "name": clerk_auth_user.name or clerk_auth_user.first_name,
            "organization_id": clerk_auth_user.organization_id,
            "notificationPreferences": {
                "create": {
                    "serviceStatusChanges": True,
                    "newIncidents": True,
                    "incidentUpdates": True,
                    "incidentResolved": True
                }
            }
        }
    )
    return created_user

@app.get("/users/me")
async def get_current_user_details(clerk_user_payload: Annotated[ClerkUserType, Depends(get_clerk_user_payload)]):
    user = await db.user.find_unique( # Changed from find_first
        where={"clerk_user_id": clerk_user_payload.id},
        include={"notificationPreferences": True, "organization": True} # Include organization
    )
    if not user:
        # This could happen if user signed in but sync failed or hasn't happened.
        # Optionally, you could trigger the sync logic here too.
        raise HTTPException(status_code=404, detail="User not found in local database. Please try syncing.")
    return user
    
@app.put("/users/me/notification-preferences")
async def update_notification_preferences(
    preferences: NotificationPreferenceUpdate,
    current_user: Annotated[Any, Depends(get_clerk_user)]
):
    user = await db.user.find_first(
        where={"email": current_user.email_addresses[0].email_address},
        include={"notificationPreferences": True}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert to dict and exclude unset values
    updated_data = {k: v for k, v in preferences.model_dump().items() if v is not None}
    
    if not user.notificationPreferences:
        # Create preferences if they don't exist
        notification_preferences = await db.notificationPreference.create(
            data={
                "user": {
                    "connect": {"id": user.id}
                },
                **updated_data
            }
        )
    else:
        # Update existing preferences
        notification_preferences = await db.notificationPreference.update(
            where={"id": user.notificationPreferences.id},
            data=updated_data
        )
    
    return notification_preferences

# New routes for uptime metrics
@app.get("/services/{service_id}/uptime")
async def get_service_uptime(
    service_id: str, 
    period: str = "daily",
    days: int = 30
):
    """Get uptime metrics for a service."""
    service = await db.service.find_unique(where={"id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    metrics = await db.uptimeMetric.find_many(
        where={
            "service_id": service_id,
            "period": period,
            "endDate": {"gte": start_date}
        },
        order_by={"startDate": "asc"}
    )
    
    return metrics

@app.get("/services/{service_id}/uptime/current")
async def get_service_current_uptime(service_id: str):
    """Get the current uptime percentage for a service."""
    service = await db.service.find_unique(where={"id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get the last 24 hours of checks
    end_date = datetime.now()
    start_date = end_date - timedelta(days=1)
    
    checks = await db.uptimeCheck.find_many(
        where={
            "service_id": service_id,
            "timestamp": {"gte": start_date}
        }
    )
    
    if not checks:
        return {"uptime": None, "checksCount": 0}
    
    total_checks = len(checks)
    up_checks = sum(1 for check in checks if check.status == "up")
    uptime_percentage = (up_checks / total_checks) * 100 if total_checks > 0 else 0
    
    return {
        "uptime": uptime_percentage,
        "checksCount": total_checks,
        "lastCheck": checks[-1].timestamp if checks else None,
        "currentStatus": checks[-1].status if checks else None
    }

@app.post("/services/{service_id}/check")
async def trigger_service_check(
    service_id: str,
    background_tasks: BackgroundTasks,
    user: Annotated[Any, Depends(get_clerk_user)]
):
    """Manually trigger an uptime check for a service."""
    service = await db.service.find_unique(where={"id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    if not service.endpoint:
        raise HTTPException(status_code=400, detail="Service has no endpoint configured")
    
    # Run the check in the background
    background_tasks.add_task(uptime_service.check_endpoint, service.endpoint)
    
    return {"message": "Check triggered"}

# API Key Management
@app.post("/api-keys")
async def create_api_key(
    api_key: ApiKeyCreate,
    user: Annotated[Any, Depends(get_clerk_user)]
):
    """Create a new API key for the organization."""
    # Get the user's organization
    user_record = await db.user.find_first(
        where={"email": user.email_addresses[0].email_address},
        include={"organization": True}
    )
    
    if not user_record or not user_record.organization:
        raise HTTPException(status_code=404, detail="User or organization not found")
    
    # Generate a new API key
    key = api_key_auth.generate_api_key()
    
    # Create the API key in the database
    created_key = await db.apiKey.create(
        data={
            "name": api_key.name,
            "key": key,
            "organization": {
                "connect": {"id": user_record.organization_id}
            }
        }
    )
    
    # Return the key (this is the only time the full key will be shown)
    return {
        "id": created_key.id,
        "name": created_key.name,
        "key": key,
        "createdAt": created_key.createdAt
    }

@app.get("/api-keys")
async def list_api_keys(user: Annotated[Any, Depends(get_clerk_user)]):
    """List all API keys for the organization."""
    # Get the user's organization
    user_record = await db.user.find_first(
        where={"email": user.email_addresses[0].email_address},
        include={"organization": True}
    )
    
    if not user_record or not user_record.organization:
        raise HTTPException(status_code=404, detail="User or organization not found")
    
    # Get all API keys for the organization
    api_keys = await db.apiKey.find_many(
        where={"organization_id": user_record.organization_id},
        order_by={"createdAt": "desc"}
    )
    
    # Don't return the actual key values
    return [
        {
            "id": key.id,
            "name": key.name,
            "isActive": key.isActive,
            "lastUsed": key.lastUsed,
            "createdAt": key.createdAt
        }
        for key in api_keys
    ]

@app.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str, user: Annotated[Any, Depends(get_clerk_user)]):
    """Delete (deactivate) an API key."""
    # Get the user's organization
    user_record = await db.user.find_first(
        where={"email": user.email_addresses[0].email_address},
        include={"organization": True}
    )
    
    if not user_record or not user_record.organization:
        raise HTTPException(status_code=404, detail="User or organization not found")
    
    # Find the API key
    api_key = await db.apiKey.find_first(
        where={
            "id": key_id,
            "organization_id": user_record.organization_id
        }
    )
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Deactivate the key (we don't actually delete it)
    await db.apiKey.update(
        where={"id": key_id},
        data={"isActive": False}
    )
    
    return {"message": "API key deactivated"}

# External API endpoints (accessible with API key)
@app.get("/api/v1/status")
async def get_status_summary(
    api_key: Annotated[Any, Depends(api_key_auth.get_api_key)]
):
    """Get a summary of all services and their current status."""
    services = await db.service.find_many(
        where={"organization_id": api_key.organization_id},
        order_by={"name": "asc"}
    )
    
    # Get active incidents
    active_incidents = await db.incident.find_many(
        where={
            "organization_id": api_key.organization_id,
            "status": {"not": "resolved"}
        },
        include={"services": True},
        order_by={"createdAt": "desc"}
    )
    
    # Calculate overall status
    all_operational = all(service.status == "operational" for service in services)
    
    return {
        "status": "operational" if all_operational else "degraded",
        "updated_at": datetime.now().isoformat(),
        "services": [
            {
                "id": service.id,
                "name": service.name,
                "status": service.status
            }
            for service in services
        ],
        "incidents": [
            {
                "id": incident.id,
                "title": incident.title,
                "status": incident.status,
                "created_at": incident.createdAt.isoformat(),
                "affected_services": [
                    {"id": service.id, "name": service.name}
                    for service in incident.services
                ]
            }
            for incident in active_incidents
        ]
    }

@app.get("/api/v1/services")
async def get_services_api(
    api_key: Annotated[Any, Depends(api_key_auth.get_api_key)]
):
    """Get a list of all services and their current status."""
    services = await db.service.find_many(
        where={"organization_id": api_key.organization_id},
        order_by={"name": "asc"}
    )
    
    return [
        {
            "id": service.id,
            "name": service.name,
            "status": service.status
        }
        for service in services
    ]

@app.get("/api/v1/incidents")
async def get_incidents_api(
    api_key: Annotated[Any, Depends(api_key_auth.get_api_key)],
    status: Optional[str] = None,
    limit: int = Query(10, ge=1, le=100)
):
    """Get a list of recent incidents."""
    where = {
        "organization_id": api_key.organization_id,
    }
    if status:
        where["status"] = status
    
    incidents = await db.incident.find_many(
        where=where,
        include={"services": True},
        order_by={"createdAt": "desc"},
        take=limit
    )
    
    return [
        {
            "id": incident.id,
            "title": incident.title,
            "status": incident.status,
            "created_at": incident.createdAt.isoformat(),
            "affected_services": [
                {"id": service.id, "name": service.name}
                for service in incident.services
            ]
        }
        for incident in incidents
    ]
