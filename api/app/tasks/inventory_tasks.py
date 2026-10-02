from celery import Celery
import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.inventory import InventoryItem

celery_app = Celery("inventory_tasks", broker="redis://localhost:6379/0")

@celery_app.task
def check_low_stock():
    """Runs daily. Sends alerts for items below reorder level."""
    asyncio.run(_check())

async def _check():
    async with AsyncSessionLocal() as db:
        low_items = await db.scalars(
            select(InventoryItem).where(InventoryItem.current_stock <= InventoryItem.reorder_level)
        )
        for item in low_items.all():
            # Mocking SMS alert to school admins
            print(f"⚠️ Low stock alert: {item.name} has {item.current_stock} {item.unit} left (reorder at {item.reorder_level})")
