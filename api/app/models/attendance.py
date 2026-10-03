"""Daily student attendance."""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, uuid_pk

STATUSES = ("present", "absent", "late", "half_day", "leave")


class AttendanceRecord(Base, TenantMixin):
    """One student's attendance for one school day. Re-marking updates the row."""
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_attendance_student_date"),
        Index("ix_attendance_section_date", "section_id", "date"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    # The section the student was in that day (students can move later).
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20))  # present | absent | late | half_day | leave
    remark: Mapped[str | None] = mapped_column(String(200))
    method: Mapped[str] = mapped_column(String(20), default="manual")  # manual | biometric | qr
    marked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
