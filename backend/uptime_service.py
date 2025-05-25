import asyncio
import aiohttp
import datetime
from prisma import Prisma
from typing import List, Dict, Any, Optional, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UptimeService:
    def __init__(self, db: Prisma):
        self.db = db
        self.check_interval = 60  # seconds between checks
    
    async def start_monitoring(self):
        """Start the uptime monitoring service."""
        logger.info("Starting uptime monitoring service")
        while True:
            try:
                await self.check_all_services()
                await self.calculate_metrics()
            except Exception as e:
                logger.error(f"Error in uptime monitoring: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    async def check_all_services(self):
        """Check the status of all services with endpoints."""
        services = await self.db.service.find_many(
            where={"endpoint": {"not": None}}
        )
        
        for service in services:
            if not service.endpoint:
                continue
                
            try:
                status, response_time = await self.check_endpoint(service.endpoint)
                
                # Record the check
                await self.db.uptimecheck.create(
                    data={
                        "service": {"connect": {"id": service.id}},
                        "status": "up" if status else "down",
                        "responseTime": response_time,
                        "timestamp": datetime.datetime.now()
                    }
                )
                
                # Update service status if needed
                if not status and service.status == "operational":
                    await self.db.service.update(
                        where={"id": service.id},
                        data={"status": "partial_outage"}
                    )
                elif status and service.status != "operational":
                    # Only auto-update to operational if there are no active incidents
                    active_incidents = await self.db.incident.count(
                        where={
                            "services": {"some": {"id": service.id}},
                            "status": {"not": "resolved"}
                        }
                    )
                    if active_incidents == 0:
                        await self.db.service.update(
                            where={"id": service.id},
                            data={"status": "operational"}
                        )
                
            except Exception as e:
                logger.error(f"Error checking service {service.id} ({service.name}): {e}")
    
    async def check_endpoint(self, url: str) -> Tuple[bool, Optional[int]]:
        """Check if an endpoint is up and return status and response time."""
        try:
            start_time = datetime.datetime.now()
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    end_time = datetime.datetime.now()
                    response_time = int((end_time - start_time).total_seconds() * 1000)
                    return response.status < 400, response_time
        except Exception as e:
            logger.error(f"Error checking endpoint {url}: {e}")
            return False, None
    
    async def calculate_metrics(self):
        """Calculate uptime metrics for different time periods."""
        now = datetime.datetime.now()
        
        # Calculate daily metrics if it's midnight
        if now.hour == 0 and now.minute < self.check_interval // 60:
            await self.calculate_period_metrics("daily", 1)
        
        # Calculate weekly metrics if it's Sunday midnight
        if now.weekday() == 6 and now.hour == 0 and now.minute < self.check_interval // 60:
            await self.calculate_period_metrics("weekly", 7)
        
        # Calculate monthly metrics if it's the 1st of the month
        if now.day == 1 and now.hour == 0 and now.minute < self.check_interval // 60:
            # Get days in previous month
            last_month = now.replace(day=1) - datetime.timedelta(days=1)
            days_in_month = last_month.day
            await self.calculate_period_metrics("monthly", days_in_month)
    
    async def calculate_period_metrics(self, period: str, days: int):
        """Calculate metrics for a specific period."""
        end_date = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - datetime.timedelta(days=days)
        
        services = await self.db.service.find_many(
            where={"endpoint": {"not": None}}
        )
        
        for service in services:
            # Get all checks for this service in the period
            checks = await self.db.uptimecheck.find_many(
                where={
                    "service_id": service.id,
                    "timestamp": {
                        "gte": start_date,
                        "lt": end_date
                    }
                }
            )
            
            if not checks:
                continue
            
            # Calculate metrics
            total_checks = len(checks)
            up_checks = sum(1 for check in checks if check.status == "up")
            uptime_percentage = (up_checks / total_checks) * 100 if total_checks > 0 else 0
            
            # Calculate average response time
            response_times = [check.responseTime for check in checks if check.responseTime is not None]
            avg_response_time = sum(response_times) // len(response_times) if response_times else None
            
            # Calculate downtime in minutes
            # Assuming checks are evenly distributed and each represents the status until the next check
            minutes_per_check = (days * 24 * 60) / total_checks if total_checks > 0 else 0
            downtime_minutes = int((total_checks - up_checks) * minutes_per_check)
            
            # Create or update the metric
            existing_metric = await self.db.uptimeMetric.find_first(
                where={
                    "service_id": service.id,
                    "period": period,
                    "startDate": start_date,
                    "endDate": end_date
                }
            )
            
            if existing_metric:
                await self.db.uptimeMetric.update(
                    where={"id": existing_metric.id},
                    data={
                        "uptime": uptime_percentage,
                        "avgResponseTime": avg_response_time,
                        "checksCount": total_checks,
                        "downtimeMinutes": downtime_minutes
                    }
                )
            else:
                await self.db.uptimeMetric.create(
                    data={
                        "service": {"connect": {"id": service.id}},
                        "period": period,
                        "startDate": start_date,
                        "endDate": end_date,
                        "uptime": uptime_percentage,
                        "avgResponseTime": avg_response_time,
                        "checksCount": total_checks,
                        "downtimeMinutes": downtime_minutes
                    }
                )
            
            logger.info(f"Calculated {period} metrics for service {service.name}: {uptime_percentage:.2f}% uptime")
