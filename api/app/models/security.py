import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base

class GatePass(Base):
    __tablename__ = "gate_passes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    pass_type: Mapped[str] = mapped_column(String(20))  # student_exit|staff_leave
    requested_for: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # student or staff id
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    exit_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    return_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    qr_token: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class GateLog(Base):
    __tablename__ = "gate_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    gate_pass_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("gate_passes.id"), nullable=True)
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    person_type: Mapped[str] = mapped_column(String(20))  # student|staff|worker|visitor
    direction: Mapped[str] = mapped_column(String(10))    # in|out
    method: Mapped[str] = mapped_column(String(20))       # qr|manual|biometric
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    logged_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

class CctvCamera(Base):
    __tablename__ = "cctv_cameras"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(200))
    stream_url: Mapped[str] = mapped_column(String(500))  # RTSP or HLS
    section_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

class CctvConsent(Base):
    __tablename__ = "cctv_consents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    camera_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cctv_cameras.id"))
    gate: Mapped[int] = mapped_column()  # 1-5
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("parent_id", "camera_id", "gate"),)

class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="valid")  # valid|expiring_soon|expired|missing
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class CampusWorker(Base):
    __tablename__ = "campus_workers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(50))  # housekeeping|security|canteen|gardener
    contractor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str] = mapped_column(String(20))
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    badge_qr: Mapped[str] = mapped_column(String(200), unique=True)
    is_active: Mapped[bool] = mapped_column(default=True)
