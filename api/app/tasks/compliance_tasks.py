from celery import Celery
import asyncio
from datetime import date, timedelta
from app.core.database import AsyncSessionLocal
from sqlalchemy import update, select
from app.models.security import ComplianceDocument

celery_app = Celery("compliance_tasks", broker="redis://localhost:6379/0")

@celery_app.task
def check_document_expiry():
    """Runs daily. Flags documents expiring within 30 days and sends alerts."""
    asyncio.run(_check_expiry())

async def _check_expiry():
    async with AsyncSessionLocal() as db:
        today = date.today()
        warning_date = today + timedelta(days=30)

        await db.execute(
            update(ComplianceDocument)
            .where(ComplianceDocument.expiry_date <= today)
            .values(status="expired")
        )
        await db.execute(
            update(ComplianceDocument)
            .where(ComplianceDocument.expiry_date > today,
                   ComplianceDocument.expiry_date <= warning_date)
            .values(status="expiring_soon")
        )
        await db.commit()
