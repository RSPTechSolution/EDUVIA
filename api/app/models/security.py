"""Gate and security: visitors, student gate passes, contract workers, the compliance vault, and CCTV with parent consent."""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Visitor(Base, TenantMixin):
    """One visit. `expected` = registered in advance by a staff member; `in` = on campus; `out` = left."""
    __tablename__ = "visitors"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(20), index=True)
    purpose: Mapped[str] = mapped_column(String(200))
    meeting: Mapped[str | None] = mapped_column(String(150))  # who they came to see, as written at the gate
    host_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    id_proof: Mapped[str | None] = mapped_column(String(60))  # e.g. "Aadhaar ••••4321" — never the full number
    vehicle_no: Mapped[str | None] = mapped_column(String(20))
    people: Mapped[int] = mapped_column(Integer, default=1)
    badge_no: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(10), default="in", index=True)  # expected | in | out | cancelled
    expected_on: Mapped[date | None] = mapped_column(Date, index=True)
    in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    photo_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    logged_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GatePass(Base, TenantMixin):
    """Permission for a student to leave during the school day, collected by a named person who shows the code at the gate."""
    __tablename__ = "gate_passes"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    reason: Mapped[str] = mapped_column(String(300))
    pickup_name: Mapped[str] = mapped_column(String(150))
    pickup_relation: Mapped[str] = mapped_column(String(50))
    pickup_phone: Mapped[str | None] = mapped_column(String(20))
    leave_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)  # pending | approved | rejected | cancelled | used
    code: Mapped[str] = mapped_column(String(6))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(String(300))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Worker(Base, TenantMixin, TimestampMixin):
    """Contract and outside workers (housekeeping, canteen, construction) with their police verification."""
    __tablename__ = "workers"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(20))
    trade: Mapped[str] = mapped_column(String(60))  # housekeeping, canteen, electrician, construction…
    agency: Mapped[str | None] = mapped_column(String(150))
    id_proof: Mapped[str | None] = mapped_column(String(60))
    police_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_on: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date)  # contract or pass end
    photo_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(String(500))


class WorkerLog(Base, TenantMixin):
    __tablename__ = "worker_logs"

    id: Mapped[uuid.UUID] = uuid_pk()
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), index=True)
    in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class ComplianceDoc(Base, TenantMixin, TimestampMixin):
    """Certificates and approvals the school must keep current: fire NOC, building safety, affiliation, water tests…"""
    __tablename__ = "compliance_docs"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(60))
    reference_no: Mapped[str | None] = mapped_column(String(100))
    authority: Mapped[str | None] = mapped_column(String(150))
    issued_on: Mapped[date | None] = mapped_column(Date)
    expires_on: Mapped[date | None] = mapped_column(Date, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    reminded_on: Mapped[date | None] = mapped_column(Date)


class Camera(Base, TenantMixin, TimestampMixin):
    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(150))
    section_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="SET NULL"), index=True)
    stream_url: Mapped[str | None] = mapped_column(String(500))  # HLS/WebRTC/viewer link from the NVR; never shown to families directly
    parent_viewable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CctvConsent(Base, TenantMixin):
    """A guardian's yes or no to classroom CCTV that includes their child."""
    __tablename__ = "cctv_consents"
    __table_args__ = (UniqueConstraint("student_id", "guardian_id", name="uq_cctv_consent"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    guardian_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    consent: Mapped[bool] = mapped_column(Boolean)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CctvView(Base, TenantMixin):
    """Who opened which camera, and when. Kept for the audit trail."""
    __tablename__ = "cctv_views"

    id: Mapped[uuid.UUID] = uuid_pk()
    camera_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
