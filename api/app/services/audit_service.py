import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def record(
    db: AsyncSession,
    action: str,
    *,
    school_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | str | None = None,
    meta: dict | None = None,
    ip: str | None = None,
) -> None:
    """Append an audit entry in the caller's transaction."""
    db.add(AuditLog(
        school_id=school_id, user_id=user_id, action=action, entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None, meta=meta or {}, ip_address=ip,
    ))
