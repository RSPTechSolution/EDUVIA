"""A record of every email the system tries to send. Bodies aren't stored: they can hold passwords."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk


class EmailLog(Base):
    __tablename__ = "email_log"

    id: Mapped[uuid.UUID] = uuid_pk()
    # Null for platform emails (e.g. the super admin's password reset).
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    to_email: Mapped[str] = mapped_column(String(320))
    to_name: Mapped[str | None] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(40), index=True)  # welcome | password_reset | fee_receipt | test | ...
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | sent | failed | logged (console mode) | skipped (demo domain)
    provider: Mapped[str] = mapped_column(String(20))
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
