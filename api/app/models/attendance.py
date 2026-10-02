import uuid
from datetime import date, datetime
from sqlalchemy import String, Date, Text, ForeignKey, UniqueConstraint, Index, DateTime, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20))  # present|absent|late|half_day
    period: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null=daily, 1-8=period
    marked_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    method: Mapped[str] = mapped_column(String(20))  # manual|biometric|qr_scan
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("student_id", "date", "period"),
        Index("ix_att_school_section_date", "school_id", "section_id", "date"),
    )

class BiometricDevice(Base):
    __tablename__ = "biometric_devices"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    device_id: Mapped[str] = mapped_column(String(50), unique=True)  # ZKTeco serial
    name: Mapped[str] = mapped_column(String(100))
    ip_address: Mapped[str] = mapped_column(String(45))
    punch_mode: Mapped[str] = mapped_column(String(10), default="both")  # in|out|both
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class BiometricPunch(Base):
    __tablename__ = "biometric_punches"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    device_id: Mapped[str] = mapped_column(String(50))
    person_id: Mapped[str] = mapped_column(String(50))  # employee/student ID on device
    punch_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    punch_type: Mapped[int] = mapped_column(Integer)  # 0=in, 1=out
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("device_id", "person_id", "punch_time"),)

class QrScanLog(Base):
    __tablename__ = "qr_scan_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    scanned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    mode: Mapped[str] = mapped_column(String(20))  # gate|classroom
