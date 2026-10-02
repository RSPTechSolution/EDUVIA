from celery import Celery
import asyncio
from datetime import date
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models.academics import Student
from app.services.gateways.msg91 import get_sms_gateway

celery_app = Celery("schoolerp_tasks", broker="redis://localhost:6379/0")

@celery_app.task
def send_birthday_greetings():
    """Runs daily at 8am. Sends greetings to students with today's birthday."""
    asyncio.run(_send_birthdays())

async def _send_birthdays():
    async with AsyncSessionLocal() as db:
        today = date.today()
        # Mock logic
        pass

@celery_app.task
def publish_engagement_creatives():
    """Publishes scheduled stories, tickers, and popups for the day."""
    pass
