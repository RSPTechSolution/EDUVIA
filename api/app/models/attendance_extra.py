"""School calendar, leave requests, biometric devices and period-wise attendance."""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class CalendarEvent(Base, TenantMixin, TimestampMixin):
    """A holiday, vacation or event. Holidays and vacations close attendance for those days."""
    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20))  # holiday | vacation | event | exam | ptm
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class LeaveRequest(Base, TenantMixin, TimestampMixin):
    """A family asking for a student's leave. Approval marks those days as leave."""
    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(20), default="sick")  # sick | family | travel | other
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending | approved | rejected | cancelled
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(String(300))


class BiometricDevice(Base, TenantMixin, TimestampMixin):
    """A fingerprint or face machine that pushes punches over the ADMS protocol (ZKTeco and compatibles)."""
    __tablename__ = "biometric_devices"
    __table_args__ = (UniqueConstraint("serial_no", name="uq_biometric_serial"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    serial_no: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(100))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    punches: Mapped[int] = mapped_column(default=0)


class BiometricPunch(Base, TenantMixin):
    """Every punch a device sent, matched or not, so staff attendance and audits can use them."""
    __tablename__ = "biometric_punches"
    __table_args__ = (UniqueConstraint("device_id", "pin", "punched_at", name="uq_punch"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("biometric_devices.id", ondelete="CASCADE"), index=True)
    pin: Mapped[str] = mapped_column(String(30), index=True)
    punched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PeriodAttendance(Base, TenantMixin):
    """Who was missing from one timetable period on one day (taken by the subject teacher)."""
    __tablename__ = "period_attendance"
    __table_args__ = (UniqueConstraint("entry_id", "date", name="uq_period_attendance"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("timetable_entries.id", ondelete="CASCADE"))
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    absent_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    marked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
