import uuid
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.communication import ChatThread, ChatMessage

async def get_thread_participants(thread_id: str) -> list:
    async with AsyncSessionLocal() as db:
        thread = await db.get(ChatThread, uuid.UUID(thread_id))
        if not thread:
            return []
        return [str(p) for p in thread.participants]

async def save_message(thread_id: str, sender_id: str, body: str, attachments: list) -> ChatMessage:
    async with AsyncSessionLocal() as db:
        msg = ChatMessage(
            thread_id=uuid.UUID(thread_id),
            sender_id=uuid.UUID(sender_id),
            body=body,
            attachments=attachments
        )
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg
