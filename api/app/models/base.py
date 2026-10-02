import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from app.core.database import Base  # noqa: F401  (re-exported)


# uuid7 (Python 3.14+) is time-ordered, which keeps B-tree indexes compact.
_new_id = getattr(uuid, "uuid7", uuid.uuid4)


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=_new_id)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class TenantMixin:
    """Rows owned by one school. Tables using this mixin MUST get an RLS policy
    in their migration (see app.db.rls.enable_tenant_rls); a test enforces it."""

    @declared_attr
    def school_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), index=True)
