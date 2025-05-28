import os
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Annotated
from pydantic import BaseModel, validator
import asyncio
import json
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import logging
# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
# Change this import
from prisma import Prisma
from prisma.models import Incident
from notification_service import NotificationService
from uptime_service import UptimeService

from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import AuthenticateRequestOptions
from clerk_backend_api.models.user import User as ClerkUser
from clerk_service import ClerkService
import subprocess
import sys

app = FastAPI(title="Status Page API")

# CORS middleware

allowed_origins = [
    "http://localhost:5173",  # Example: Common Vite dev server
    "https://public-status-page.vercel.app",    # Example: Your custom domain for the frontend
    # Add any other origins your frontend might be served from
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        
        async with self._lock:
            for connection in self.active_connections:
                try:
                    await connection.send_text(message)
                except (WebSocketDisconnect, RuntimeError):
                    # Mark for removal if connection is closed or has an error
                    disconnected.append(connection)
                except Exception as e:
                    print(f"Error broadcasting message: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

manager = ConnectionManager()

# Initialize Prisma client
db = Prisma(auto_register=True)

# Initialize Clerk SDK
clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))

# Initialize Clerk service with the clerk client
clerk_service = ClerkService(clerk)

# Initialize Uptime Service
u = UptimeService(db)

# Initialize Notification Service
notification_service = NotificationService(db)
uptime_service = UptimeService(db)

@app.on_event("startup")
async def startup():
    try:
        # Connect to the database
        await db.connect()
        print("✅ Connected to database successfully")
        
        # Start the uptime monitoring service
        asyncio.create_task(u.start_monitoring())
        print("✅ Started uptime monitoring")
        
        # Initialize notification service
        print("✅ Notification service initialized")
        
    except Exception as e:
        print(f"⚠️ Error during startup: {e}")
        raise

@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()

# Clerk authentication dependency
async def get_clerk_user_payload(request: Request, authorization: Annotated[Optional[str], Header()] = None) -> ClerkUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        request_state = clerk.authenticate_request(
            request, 
            AuthenticateRequestOptions() 
        )

        if not request_state.is_signed_in:
            detail = "User not authenticated"
            if request_state.reason: # Provide more specific reason if available
                detail += f": {request_state.reason}"
            if hasattr(request_state, 'message') and request_state.message:
                detail += f" - {request_state.message}"
            print(f"AuthN failed in get_clerk_user_payload: is_signed_in=False. Details: {detail}")
            raise HTTPException(status_code=401, detail=detail)

        # The user_id is in the token payload, not directly on request_state
        if not request_state.payload or not request_state.payload.get('sub'):
            print("AuthN failed in get_clerk_user_payload: user_id missing from token payload.")
            raise HTTPException(status_code=401, detail="User ID not found in token claims.")

        user_id = request_state.payload.get('sub')

        # Fetch the full user object from Clerk API using the user_id from the token
        try:
            # clerk.users is an instance of UsersApi, get_user is a method on it
            fetched_user: ClerkUser = clerk.users.get(user_id=user_id)
            return fetched_user
        except Exception as e:
            # Catch specific exceptions from Clerk SDK if possible, e.g., clerk_backend_api.errors.ApiException
            print(f"Failed to fetch user (ID: {user_id}) details from Clerk: {type(e).__name__} - {e}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve user details from authentication provider.")

    except HTTPException as e: # Re-raise HTTPExceptions
        raise e
    except Exception as e:
        print(f"Unexpected authentication error in get_clerk_user_payload: {type(e).__name__} - {e}")
        # Log the stack trace for unexpected errors
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Authentication failed due to an unexpected error: {str(e)}")

# Modify get_clerk_user similarly if it's used and expected to return a full ClerkUser object
async def get_clerk_user(request: Request, authorization: Annotated[Optional[str], Header()] = None) -> ClerkUser:
    # This function now mirrors get_clerk_user_payload for consistency
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing for get_clerk_user")

    try:
        request_state = clerk.authenticate_request(
            request,
            AuthenticateRequestOptions()
        )
        
        if not request_state.is_signed_in:
            detail = "User not authenticated"
            if request_state.reason:
                detail += f": {request_state.reason}"
            if hasattr(request_state, 'message') and request_state.message:
                detail += f" - {request_state.message}"
            print(f"AuthN failed in get_clerk_user: is_signed_in=False. Details: {detail}")
            raise HTTPException(status_code=401, detail=detail)

        # The user_id is in the token payload, not directly on request_state
        if not request_state.payload or not request_state.payload.get('sub'):
            print("AuthN failed in get_clerk_user: user_id missing from token payload.")
            raise HTTPException(status_code=401, detail="User ID not found in token claims for get_clerk_user.")

        user_id = request_state.payload.get('sub')

        try:
            fetched_user: ClerkUser = clerk.users.get(user_id=user_id)
            return fetched_user
        except Exception as e:
            print(f"Failed to fetch user (ID: {user_id}) details from Clerk in get_clerk_user: {type(e).__name__} - {e}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve user details.")
            
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected authentication error in get_clerk_user: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Authentication failed in get_clerk_user due to an unexpected error: {str(e)}")
    # Models
class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: str
    endpoint: Optional[str] = None
    status: Optional[str] = "operational"
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "API Service",
                "description": "Main API service",
                "organization_id": "org_123",
                "endpoint": "https://api.example.com/health",
                "status": "operational"
            }
        }
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["operational", "degraded", "partial_outage", "major_outage", "maintenance"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {', '.join(allowed_statuses)}")
        return v

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    endpoint: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v is None:
            return v
        allowed_statuses = ["operational", "degraded", "partial_outage", "major_outage", "maintenance"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {', '.join(allowed_statuses)}")
        return v

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
    incident_id: Optional[str] = None

class OrganizationCreate(BaseModel):
    name: str
    clerk_org_id: Optional[str] = None

class OrganizationCreateWithClerk(BaseModel):
    name: str
    slug: Optional[str] = None

class OrganizationSwitchRequest(BaseModel):
    organization_id: str

class OrganizationMemberCreate(BaseModel):
    email: str
    role: str = "basic_member"



# Routes
@app.get("/")
async def root():
    return {"message": "Status Page API"}

@app.post("/organizations")
async def create_organization(org: OrganizationCreate, user: Annotated[ClerkUser, Depends(get_clerk_user_payload)]):
    """
    Create an organization in both the database and Clerk, and associate the current user as an admin.
    """
    clerk_org_id = org.clerk_org_id
    
    # Get user's email for database association
    user_email = None
    if hasattr(user, 'email_addresses') and user.email_addresses:
        primary_email_id = getattr(user, 'primary_email_address_id', None)
        if primary_email_id:
            primary_email = next((e for e in user.email_addresses if hasattr(e, 'id') and e.id == primary_email_id), None)
            if primary_email and hasattr(primary_email, 'email_address'):
                user_email = primary_email.email_address
    
    if not user_email:
        raise HTTPException(status_code=400, detail="User email is required to create an organization")
    
    # Create organization in Clerk
    if not clerk_org_id:
        try:
            # Create organization in Clerk
            clerk_org = await clerk_service.create_organization(name=org.name)
            clerk_org_id = clerk_org.id
            
            # Add the current user as admin to the organization in Clerk
            await clerk_service.add_user_to_organization(
                user_id=user.id,
                organization_id=clerk_org_id,
                role="admin"
            )
        except Exception as e:
            logger.error(f"Error creating organization in Clerk: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create organization in Clerk: {str(e)}")
    
    # Create organization in database and associate the user
    try:
        # First, ensure the user exists in our database
        db_user = await db.user.find_unique(where={"clerk_user_id": user.id})
        
        if not db_user:
            # Create the user if they don't exist
            db_user = await db.user.create(
                data={
                    "clerk_user_id": user.id,
                    "email": user_email,
                    "name": getattr(user, 'first_name', '') + ' ' + getattr(user, 'last_name', ''),
                    "organization": {
                        "connect": {
                            "clerk_org_id": clerk_org_id
                        }
                    }
                }
            )
        
        # Create the organization
        created_org = await db.organization.create(
            data={
                "name": org.name,
                "clerk_org_id": clerk_org_id,
                "users": {
                    "connect": [{"id": db_user.id}]
                }
            }
        )
        
        return created_org
        
    except Exception as e:
        # If we created the org in Clerk but failed in the database, clean up
        if not org.clerk_org_id:  # Only if we created it in this request
            try:
                await clerk_service.delete_organization(clerk_org_id)
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up Clerk organization after database error: {cleanup_error}")
        
        logger.error(f"Error creating organization in database: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create organization in database: {str(e)}")

@app.get("/organizations")
async def get_organizations(user: Annotated[ClerkUser, Depends(get_clerk_user_payload)]):
    """
    Get all organizations that the current user is a member of.
    This is a read-only endpoint that only returns existing organizations.
    """
    try:
        logger.info(f"Fetching organizations for user ID: {user.id}")
        
        # Get user's organization memberships from Clerk
        memberships = await clerk_service.get_user_organizations(user_id=user.id)
        logger.info(f"Retrieved {len(memberships)} memberships from Clerk for user {user.id}")
        
        if not memberships or not isinstance(memberships, list) or len(memberships) == 0:
            logger.info(f"User {user.id} has no organization memberships.")
            return []
        
        # Extract clerk organization IDs
        clerk_org_ids = [
            membership['organization']['id']
            for membership in memberships
            if isinstance(membership, dict) and 'organization' in membership and 'id' in membership['organization']
        ]
        
        if not clerk_org_ids:
            logger.info(f"No valid organization IDs found for user {user.id}")
            return []
        
        logger.info(f"Fetching organizations from database for IDs: {clerk_org_ids}")
        
        # Get organizations from database
        db_organizations = await db.organization.find_many(
            where={"clerk_org_id": {"in": clerk_org_ids}}
        )
        
        logger.info(f"Found {len(db_organizations)} organizations in database for user {user.id}")
        
        # Create a mapping of clerk_org_id to membership for easier lookup
        membership_map = {
            m['organization']['id']: m 
            for m in memberships 
            if isinstance(m, dict) and 'organization' in m and 'id' in m['organization']
        }
        
        # Prepare the result with organization data
        result = []
        for db_org in db_organizations:
            membership = membership_map.get(db_org.clerk_org_id)
            if not membership or 'organization' not in membership:
                continue
                
            clerk_org = membership['organization']
            member_role = membership.get('role', 'basic_member')
            
            # Format created_at timestamp
            clerk_created_at = clerk_org.get('created_at')
            clerk_created_at_str = ""
            if clerk_created_at is not None:
                if isinstance(clerk_created_at, (int, float)):  # Unix timestamp (ms)
                    clerk_created_at_str = datetime.fromtimestamp(clerk_created_at / 1000).isoformat()
                elif isinstance(clerk_created_at, datetime):
                    clerk_created_at_str = clerk_created_at.isoformat()
                else:
                    clerk_created_at_str = str(clerk_created_at)
            
            # Prepare organization data
            org_data = {
                "id": str(db_org.id),
                "name": db_org.name,
                "clerk_org_id": db_org.clerk_org_id,
                "createdAt": db_org.createdAt.isoformat(),
                "updatedAt": db_org.updatedAt.isoformat(),
                "clerk_details": {
                    "name": clerk_org.get('name', db_org.name),
                    "slug": clerk_org.get('slug'),
                    "created_at": clerk_created_at_str,
                    "role": member_role
                }
            }
            result.append(org_data)
        
        logger.info(f"Returning {len(result)} organizations for user {user.id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in get_organizations for user ID {user.id if user else 'UNKNOWN'}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get organizations: {str(e)}")
        
@app.post("/organizations/{organization_id}/members")
async def add_organization_member(
    organization_id: str,
    member_data: OrganizationMemberCreate,
    user: Annotated[ClerkUser, Depends(get_clerk_user_payload)]
):
    """
    Add a member to an organization
    """
    # Verify the organization exists
    org = await db.organization.find_unique(where={"id": organization_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Verify the current user is an admin of this organization
    memberships = await clerk_service.get_user_organizations(user_id=user.id)
    is_admin = False
    
    # Check each membership to see if the user is an admin of this organization
    for m in memberships:
        # Check if membership has organization as attribute or dict key
        if hasattr(m, 'organization') and hasattr(m, 'role'):
            if m.organization.id == org.clerk_org_id and m.role == "admin":
                is_admin = True
                break
        elif isinstance(m, dict) and 'organization' in m and 'role' in m:
            if m['organization'].id == org.clerk_org_id and m['role'] == "admin":
                is_admin = True
                break
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="You must be an admin to add members")
    
    # Check if the user exists in Clerk
    try:
        clerk_user = clerk.users.get_user_list(email_address=[member_data.email])
        if not clerk_user or len(clerk_user) == 0:
            raise HTTPException(status_code=404, detail="User not found in Clerk")
        
        clerk_user_id = clerk_user[0].id
        
        # Add user to organization in Clerk
        await clerk_service.add_user_to_organization(
            user_id=clerk_user_id,
            organization_id=org.clerk_org_id,
            role=member_data.role
        )
        
        # Check if user exists in database
        db_user = await db.user.find_first(where={"clerk_user_id": clerk_user_id})
        
        if not db_user:
            # Create user in database
            db_user = await db.user.create(
                data={
                    "clerk_user_id": clerk_user_id,
                    "email": member_data.email,
                    "name": clerk_user[0].first_name,
                    "organization_id": organization_id
                }
            )
            
            # Create default notification preferences
            await db.notificationpreference.create(
                data={
                    "user_id": db_user.id,
                    "serviceStatusChanges": True,
                    "newIncidents": True,
                    "incidentUpdates": True,
                    "incidentResolved": True
                }
            )
        
        return {
            "message": "Member added successfully",
            "user_id": db_user.id,
            "email": member_data.email,
            "role": member_data.role
        }
    except Exception as e:
        logger.error(f"Error adding member to organization: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add member: {str(e)}")

@app.get("/organizations/{clerk_org_id}")
async def get_organization(clerk_org_id: str):
    org = await db.organization.find_first(
        where={"clerk_org_id": clerk_org_id}
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@app.post("/organizations/switch")
async def switch_organization(
    switch_request: OrganizationSwitchRequest,
    user: Annotated[ClerkUser, Depends(get_clerk_user_payload)]
):
    """
    Switch the user's active organization
    """
    try:
        # Verify the organization exists in the database
        org = await db.organization.find_unique(
            where={"id": switch_request.organization_id}
        )
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Verify the user is a member of this organization in Clerk
        memberships = await clerk_service.get_user_organizations(user_id=user.id)
        is_member = False
        
        # Check each membership to see if the user is a member of this organization
        for m in memberships:
            # Check if membership has organization as attribute or dict key
            if hasattr(m, 'organization') and hasattr(m.organization, 'id'):
                if m.organization.id == org.clerk_org_id:
                    is_member = True
                    break
            elif isinstance(m, dict) and 'organization' in m:
                if hasattr(m['organization'], 'id') and m['organization'].id == org.clerk_org_id:
                    is_member = True
                    break
        
        if not is_member:
            raise HTTPException(
                status_code=403, 
                detail="You are not a member of this organization"
            )
        
        # Update the user's active organization in the database
        updated_user = await db.user.update(
            where={"clerk_user_id": user.id},
            data={"organization_id": switch_request.organization_id}
        )
        
        return {
            "message": "Organization switched successfully",
            "organization_id": switch_request.organization_id,
            "organization_name": org.name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error switching organization: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to switch organization: {str(e)}")
# Service routes
@app.post("/services")
async def create_service(service: ServiceCreate, user: Annotated[Any, Depends(get_clerk_user)]):
    created_service = await db.service.create(
        data={
            "name": service.name,
            "description": service.description,
            "status": service.status,
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
    update_data = service_update.model_dump(exclude_unset=True)
    
    # Only update if there are changes
    if not update_data:
        return current_service
    
    # Update the service
    service = await db.service.update(
        where={"id": service_id},
        data=update_data
    )
    
    # If status has changed, send notification
    if service_update.status is not None and service_update.status != old_status:
        await notification_service.send_service_status_change_notification(
            service_id=service_id,
            old_status=old_status,
            new_status=service_update.status
        )
    
    # Always broadcast the update
    await manager.broadcast(json.dumps({
        "type": "service_updated",
        "data": {
            "id": service.id,
            "name": service.name,
            "status": service.status,
            "description": service.description,
            "endpoint": service.endpoint,
            "updatedAt": service.updatedAt.isoformat() if hasattr(service, 'updatedAt') else datetime.now(timezone.utc).isoformat()
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
@app.post("/incidents/", response_model=dict)
async def create_incident(incident: IncidentCreate, user: Annotated[Any, Depends(get_clerk_user)]):
    # Create the incident
    try:
        # First, create the incident without services to get an ID
        created_incident = await db.incident.create(
            data={
                "title": incident.title,
                "description": incident.description,
                "status": incident.status,
                "organization": {"connect": {"id": incident.organization_id}},
            }
        )
        
        # Then connect the services
        if incident.service_ids:
            await db.incident.update(
                where={"id": created_incident.id},
                data={
                    "services": {
                        "connect": [{"id": service_id} for service_id in incident.service_ids]
                    }
                }
            )
        
        # Get the full incident with services for the response
        result = await db.incident.find_unique(
            where={"id": created_incident.id},
            include={"services": True, "organization": True}
        )
        
        # Send new incident notification
        await notification_service.send_new_incident_notification(incident_id=result.id)
        
        # Broadcast the new incident
        await manager.broadcast(json.dumps({
            "type": "incident_created",
            "data": {
                "id": result.id,
                "title": result.title,
                "status": result.status,
                "createdAt": result.createdAt.isoformat() if hasattr(result, 'createdAt') else datetime.now(timezone.utc).isoformat(),
                "services": [{"id": s.id, "name": s.name} for s in result.services]
            }
        }))
        
        return result
        
    except Exception as e:
        print(f"Error creating incident: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create incident: {str(e)}")

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
    # Get the current incident with services and organization
    current_incident = await db.incident.find_unique(
        where={"id": incident_id},
        include={"services": True, "organization": True}
    )
    if not current_incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    old_status = current_incident.status
    
    try:
        # Convert to dict and exclude unset values
        updated_data = {k: v for k, v in incident_update.model_dump(exclude_unset=True).items()}
        
        # Handle service connections separately
        service_ids = updated_data.pop("service_ids", None)
        
        # Update the incident with the new data
        incident = await db.incident.update(
            where={"id": incident_id},
            data=updated_data,
            include={"services": True, "organization": True}
        )
        
        # Update services if needed
        if service_ids is not None:
            incident = await db.incident.update(
                where={"id": incident_id},
                data={
                    "services": {
                        "set": [{"id": service_id} for service_id in service_ids]
                    }
                },
                include={"services": True, "organization": True}
            )
        
        # Handle status changes
        if incident_update.status and incident_update.status != old_status:
            # If status changed to resolved, send resolved notification
            if incident_update.status == "resolved":
                await notification_service.send_incident_resolved_notification(
                    incident_id=incident_id
                )
                
                # Check if we need to update any service statuses
                for service in incident.services:
                    # Check if there are any other active incidents for this service
                    active_incidents = await db.incident.count(
                        where={
                            "services": {"some": {"id": service.id}},
                            "status": {"not": "resolved"},
                            "id": {"not": incident_id}  # Exclude the current incident
                        }
                    )
                    
                    # If no active incidents, set service status to operational
                    if active_incidents == 0:
                        await db.service.update(
                            where={"id": service.id},
                            data={"status": "operational"}
                        )
                        
                        # Broadcast service status update
                        await manager.broadcast(json.dumps({
                            "type": "service_updated",
                            "data": {
                                "id": service.id,
                                "status": "operational",
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            }
                        }))
        
        # Broadcast the incident update
        await manager.broadcast(json.dumps({
            "type": "incident_updated",
            "data": {
                "id": incident.id,
                "title": incident.title,
                "status": incident.status,
                "updatedAt": incident.updatedAt.isoformat() if hasattr(incident, 'updatedAt') else datetime.now(timezone.utc).isoformat(),
                "services": [{"id": s.id, "name": s.name} for s in incident.services]
            }
        }))
        
        return incident
        
    except Exception as e:
        print(f"Error updating incident: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update incident: {str(e)}")

@app.delete("/incidents/{incident_id}")
async def delete_incident(incident_id: str, user: Annotated[Any, Depends(get_clerk_user)]):
    await db.incident.delete(where={"id": incident_id})
    await manager.broadcast(json.dumps({
        "type": "incident_deleted",
        "data": {"id": incident_id}
    }))
    return {"message": "Incident deleted"}

# Update routes
@app.post("/incidents/{incident_id}/updates")
async def create_incident_update(
    incident_id: str,
    update: UpdateCreate,
    user: Annotated[Any, Depends(get_clerk_user)]
):
    # Ensure the incident exists
    incident = await db.incident.find_unique(
        where={"id": incident_id}, 
        include={"updates": True, "organization": True}
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    try:
        # Create the update with the correct field names for Prisma
        new_update = await db.update.create(
            data={
                "message": update.message,
                "incident": {"connect": {"id": incident_id}},
            },
            include={
                "incident": True
            }
        )
        
        # Send notification for the new update
        await notification_service.send_incident_update_notification(
            update_id=new_update.id
        )
        
        # If this is a resolution update, send resolved notification
        if update.message.lower().startswith("resolved"):
            await notification_service.send_incident_resolved_notification(
                incident_id=incident_id
            )
        
        # Prepare the update data for WebSocket broadcast
        update_data = {
            "id": str(new_update.id),
            "message": new_update.message,
            "createdAt": new_update.createdAt.isoformat() if hasattr(new_update, 'createdAt') else datetime.now(timezone.utc).isoformat(),
            "incident_id": incident_id,
            "user": {
                "id": user.id,
                "name": getattr(user, 'name', 'Unknown'),
                "email": getattr(user, 'email', '')
            }
        }
        
        # Notify WebSocket clients
        await manager.broadcast(json.dumps({
            "type": "update_created",
            "data": update_data
        }))
        
        return new_update
        
    except Exception as e:
        print(f"Error creating incident update: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create update: {str(e)}")

# Original update endpoint
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
            try:
                # Keep the connection alive by receiving messages
                # We don't actually need to do anything with the messages
                await websocket.receive_text()
            except WebSocketDisconnect:
                # If disconnect happens during receive, break the loop
                break
            except RuntimeError as e:
                if "No response return" in str(e):
                    # This can happen when the client disconnects unexpectedly
                    break
                raise
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Ensure we clean up the connection
        await manager.disconnect(websocket)
        try:
            await websocket.close()
        except Exception as e:
            print(f"Error closing WebSocket: {e}")

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
    pass

class NotificationPreferenceResponse(BaseModel):
    serviceStatusChanges: bool
    newIncidents: bool
    incidentUpdates: bool
    incidentResolved: bool

# The pass for NotificationPreferenceUpdate is a placeholder to ensure the class definition itself is not removed if it's the exact target. The original content of NotificationPreferenceUpdate should be preserved by the tool if it's smart, or I might need to re-paste it if it gets clobbered. Assuming the tool is smart enough to insert *around* or *after* the target if the replacement is just adding new classes.
# Better target: insert *before* the PUT route.
# Let's try a more specific target for insertion for the new GET route.
# Target: the line before '@app.put("/users/me/notification-preferences")'
# However, the tool requires TargetContent. So, I'll target a known line and insert the new content relative to it.
# The class NotificationPreferenceUpdate is a good anchor.
    serviceStatusChanges: Optional[bool] = None
    newIncidents: Optional[bool] = None
    incidentUpdates: Optional[bool] = None
    incidentResolved: Optional[bool] = None


@app.get("/users/me/notification-preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    current_user_payload: Annotated[ClerkUser, Depends(get_clerk_user_payload)]
):
    user_from_db = await db.user.find_unique(
        where={"clerk_user_id": current_user_payload.id},
        include={"notificationPreferences": True}
    )
    
    if not user_from_db:
        raise HTTPException(status_code=404, detail="User not found in local database.")
    
    if not user_from_db.notificationPreferences:
        # This implies that notification preferences were not created with the user or were deleted.
        where={"clerk_user_id": current_user_payload.id},
        include={"notificationPreferences": True}
    
    
    if not user_from_db:
        raise HTTPException(status_code=404, detail="User not found in local database.")

    # Convert to dict and exclude unset values
    updated_data = notification_preferences.dict(exclude_unset=True)
    
    if not user_from_db.notificationPreferences:
        # Create preferences if they don't exist
        notification_preferences = await db.notificationpreference.create(
            data={
                "user": {
                    "connect": {"id": user_from_db.id}
                },
                **updated_data
            }
        )
    else:
        # Update existing preferences
        notification_preferences = await db.notificationpreference.update(
            where={"id": user_from_db.notificationPreferences.id},
            data=updated_data
        )
    
    return NotificationPreferenceResponse(
        serviceStatusChanges=notification_preferences.serviceStatusChanges,
        newIncidents=notification_preferences.newIncidents,
        incidentUpdates=notification_preferences.incidentUpdates,
        incidentResolved=notification_preferences.incidentResolved,
    )


@app.post("/users/ensure-synced", response_model=SyncedUserResponse)
async def ensure_user_synced(clerk_user_payload: Annotated[ClerkUser, Depends(get_clerk_user_payload)]):
    clerk_id = clerk_user_payload.id

    # Get email and name from Clerk user
    primary_email_obj = None
    if clerk_user_payload.primary_email_address_id and clerk_user_payload.email_addresses:
        primary_email_obj = next(
            (em for em in clerk_user_payload.email_addresses if em.id == clerk_user_payload.primary_email_address_id),
            None
        )

    if not primary_email_obj:
        if clerk_user_payload.email_addresses:
            primary_email_obj = next(
                (em for em in clerk_user_payload.email_addresses if em.verification and em.verification.status == 'verified'),
                None # Try first verified
            )
        if not primary_email_obj: # Fallback to first email if no verified one found
            primary_email_obj = clerk_user_payload.email_addresses[0]

    if not primary_email_obj: # If still no email
        raise HTTPException(status_code=400, detail="Primary or verified email not found for Clerk user.")

    email = primary_email_obj.email_address

    name = None
    if clerk_user_payload.first_name and clerk_user_payload.last_name:
        name = f"{clerk_user_payload.first_name} {clerk_user_payload.last_name}".strip()
    elif clerk_user_payload.first_name:
        name = clerk_user_payload.first_name
    elif clerk_user_payload.username:
        name = clerk_user_payload.username

    # Check if user exists in database
    db_user = await db.user.find_unique(where={"clerk_user_id": clerk_id})

    if db_user:
        # User exists, update if needed
        updated_data = {}
        if name and db_user.name != name:
            updated_data["name"] = name
        if email and db_user.email != email:
            updated_data["email"] = email

        if updated_data:
            db_user = await db.user.update(where={"clerk_user_id": clerk_id}, data=updated_data)

        # Return existing user
        return SyncedUserResponse.model_validate(db_user.model_dump())

    # User not found, create them
    local_org_id_to_link = None

    async def create_personal_organization(user_id: str, user_name: str, user_email: str):
        """Helper function to create a personal organization for a user"""
        org_name = f"{user_name}'s Workspace" if user_name else f"{user_email.split('@')[0]}'s Workspace"
        personal_org_id = f"personal_{user_id}"
        
        # Check if personal organization already exists
        existing_org = await db.organization.find_unique(
            where={"clerk_org_id": personal_org_id}
        )
        
        if existing_org:
            return existing_org.id
            
        try:
            # Try to create organization in Clerk first
            clerk_org = await clerk_service.create_organization(name=org_name)
            clerk_org_id = clerk_org.id
            
            # Add user to the organization as admin
            try:
                await clerk_service.add_user_to_organization(
                    user_id=user_id,
                    organization_id=clerk_org_id,
                    role="org:admin"
                )
            except Exception as add_error:
                logger.error(f"Error adding user to organization: {add_error}")
            
            # Create organization in database with the Clerk organization ID
            new_org = await db.organization.create(
                data={"name": org_name, "clerk_org_id": clerk_org_id}
            )
            return new_org.id
            
        except Exception as e:
            logger.error(f"Error creating personal organization in Clerk: {e}")
            # Fallback to local-only organization
            try:
                new_org = await db.organization.create(
                    data={"name": org_name, "clerk_org_id": personal_org_id}
                )
                logger.info(f"Created local-only organization for user {user_id}")
                return new_org.id
            except Exception as db_error:
                logger.error(f"Failed to create organization in database: {db_error}")
                return None

    # Fetch organization memberships from Clerk
    try:
        # Get all organization memberships for this user
        org_memberships = []
        try:
            org_memberships = await clerk_service.get_user_organizations(user_id=clerk_id)
        except Exception as e:
            logger.warning(f"Error fetching organizations for user {clerk_id}: {str(e)}")
            org_memberships = []

        # If user has organization memberships, use the first one
        if org_memberships and isinstance(org_memberships, list) and org_memberships:
            active_org_membership = org_memberships[0]
            clerk_org_details = None
            clerk_org_id_from_member = None
            
            # Extract organization ID from membership
            if hasattr(active_org_membership, 'organization'):
                clerk_org_details = active_org_membership.organization
                if hasattr(clerk_org_details, 'id'):
                    clerk_org_id_from_member = clerk_org_details.id
            elif isinstance(active_org_membership, dict) and 'organization' in active_org_membership:
                clerk_org_details = active_org_membership['organization']
                if hasattr(clerk_org_details, 'id'):
                    clerk_org_id_from_member = clerk_org_details.id
            
            if clerk_org_id_from_member:
                # Get or create the organization in our database
                org_name = getattr(clerk_org_details, 'name', None) or f"{name}'s Organization" if name else f"{email.split('@')[0]}'s Organization"
                
                local_org = await db.organization.find_unique(
                    where={"clerk_org_id": clerk_org_id_from_member}
                )
                
                if local_org:
                    local_org_id_to_link = local_org.id
                else:
                    # Create organization in our database
                    local_org = await db.organization.create(
                        data={"name": org_name, "clerk_org_id": clerk_org_id_from_member}
                    )
                    local_org_id_to_link = local_org.id
            
        # If we still don't have an organization, create a personal one
        if not local_org_id_to_link:
            local_org_id_to_link = await create_personal_organization(clerk_id, name, email)
            
    except Exception as e:
        logger.error(f"Error processing organization memberships for user {clerk_id}: {e}")
        # Create a personal organization as fallback
        local_org_id_to_link = await create_personal_organization(clerk_id, name, email)

    if not local_org_id_to_link:
        raise HTTPException(status_code=500, detail="Failed to determine or create organization for the user.")

    # Create user in database
    created_user_data = {
        "clerk_user_id": clerk_id,
        "email": email,
        "name": name,
        "organization_id": local_org_id_to_link,
    }

    # Create user first, then notification preferences
    created_user = await db.user.create(data=created_user_data)

    # Create default notification preferences for the new user
    await db.notificationpreference.create(
        data={
            "user_id": created_user.id,
            "serviceStatusChanges": True,
            "newIncidents": True,
            "incidentUpdates": True,
            "incidentResolved": True
        }
    )

    # Fetch the user again to ensure all fields are current
    final_user_for_response = await db.user.find_unique(where={"id": created_user.id})
    return SyncedUserResponse.model_validate(final_user_for_response.model_dump())
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
async def get_current_user_details(clerk_user_payload: Annotated[ClerkUser, Depends(get_clerk_user_payload)]):
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
        notification_preferences = await db.notificationpreference.create(
            data={
                "user": {
                    "connect": {"id": user.id}
                },
                **updated_data
            }
        )
    else:
        # Update existing preferences
        notification_preferences = await db.notificationpreference.update(
            where={"id": user.notificationPreferences.id},
            data=updated_data
        )
    
    return notification_preferences


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

@app.get("/services/{service_id}/metrics/uptime")
async def get_service_uptime_metrics(
    service_id: str,
    user: Annotated[Any, Depends(get_clerk_user)],
    period: str = Query("7d", regex="^(24h|7d|30d)$")
) -> dict:
    """
    Get uptime metrics for a service based on incident history
    """
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    """
    Get uptime metrics for a service based on incident history
    """
    # Calculate time range based on period
    now = datetime.utcnow().replace(tzinfo=timezone.utc)  # Make now timezone-aware
    if period == "24h":
        start_time = now - timedelta(hours=24)
        days = 1
    elif period == "7d":
        start_time = now - timedelta(days=7)
        days = 7
    else:  # 30d
        start_time = now - timedelta(days=30)
        days = 30
    
    # Get all incidents for this service within the time range
    incidents = await db.incident.find_many(
        where={
            "services": {
                "some": {
                    "id": service_id
                }
            },
            "OR": [
                {"createdAt": {"gte": start_time}},
                {"updatedAt": {"gte": start_time}},
                {"status": {"not": "resolved"}}
            ]
        },
        include={
            "services": {
                "where": {"id": service_id}
            }
        },
        order={"createdAt": "asc"}
    )
    
    # Calculate uptime based on incident history
    total_seconds = days * 24 * 60 * 60
    downtime_seconds = 0
    
    # Track current incident if any
    current_incident = None
    
    # Sort incidents by creation time
    sorted_incidents = sorted(incidents, key=lambda x: x.createdAt)
    
    # Calculate downtime
    for incident in sorted_incidents:
        # Ensure incident_end is timezone-aware
        if incident.status != "resolved":
            # If incident is still ongoing, count until now (convert now to same timezone as incident.updatedAt)
            incident_end = now.astimezone(incident.updatedAt.tzinfo) if incident.updatedAt.tzinfo else now
        else:
            incident_end = incident.updatedAt
            
        # Only count if the incident overlaps with our time range
        if incident_end > start_time:
            # Ensure start_time is timezone-aware with same timezone as incident
            start_time_aware = start_time.replace(tzinfo=incident.createdAt.tzinfo)
            incident_start = max(incident.createdAt, start_time_aware)
            # Ensure both datetimes are timezone-aware before subtraction
            if incident_end.tzinfo is None or incident_start.tzinfo is None:
                # If either is naive, make them both naive for the calculation
                if incident_end.tzinfo is not None:
                    incident_end = incident_end.replace(tzinfo=None)
                if incident_start.tzinfo is not None:
                    incident_start = incident_start.replace(tzinfo=None)
            downtime_seconds += (incident_end - incident_start).total_seconds()
    
    # Calculate uptime percentage (clamped between 0 and 100)
    uptime_percentage = max(0, min(100, 100 - (downtime_seconds / total_seconds * 100)))
    
    # For backward compatibility, create a dummy response
    return {
        f"uptime{period}": round(uptime_percentage, 2),
        "avgResponseTime": 0,  # Not available without UptimeCheck
        "checks": []  # Not available without UptimeCheck
    }

@app.get("/services")
async def get_services():
    """Get a list of all services and their current status."""
    services = await db.service.find_many(
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

@app.get("/incidents")
async def get_incidents(
    status: Optional[str] = None,
    limit: int = Query(10, ge=1, le=100)
):
    """Get a list of recent incidents."""
    where = {}
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