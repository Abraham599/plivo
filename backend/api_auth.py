from fastapi import Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from prisma import Prisma
from datetime import datetime
import secrets
import string
from typing import Annotated

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

class ApiKeyAuth:
    def __init__(self, db: Prisma):
        self.db = db
    
    async def get_api_key(self, api_key_header: Annotated[str, Security(API_KEY_HEADER)] = None):
        if not api_key_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key is missing",
            )
        
        api_key = await self.db.apiKey.find_first(
            where={
                "key": api_key_header,
                "isActive": True
            },
            include={"organization": True}
        )
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or inactive API key",
            )
        
        # Update last used timestamp
        await self.db.apiKey.update(
            where={"id": api_key.id},
            data={"lastUsed": datetime.now()}
        )
        
        return api_key
    
    @staticmethod
    def generate_api_key(length=32):
        """Generate a secure random API key."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))
