import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Numeric, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base

class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))  # Basic, Pro, Enterprise
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    interval: Mapped[str] = mapped_column(String(20))  # monthly|yearly|onetime
    modules: Mapped[list] = mapped_column(ARRAY(String), default=list)  # module slugs
    max_students: Mapped[int | None] = mapped_column(nullable=True)
    max_staff: Mapped[int | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)

class SchoolSubscription(Base):
    __tablename__ = "school_subscriptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    gateway_sub_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SchoolBranding(Base):
    __tablename__ = "school_brandings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    primary_color: Mapped[str] = mapped_column(String(7), default="#1A3C5E")
    accent_color: Mapped[str] = mapped_column(String(7), default="#2E7D9E")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    font_family: Mapped[str] = mapped_column(String(100), default="Inter")
    custom_css: Mapped[str | None] = mapped_column(Text, nullable=True)
    firebase_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # encrypted at service level
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class BackupConfig(Base):
    __tablename__ = "backup_configs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(20))  # r2|b2|telegram
    credentials: Mapped[dict] = mapped_column(JSONB)   # AES-256 encrypted
    bucket_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(default=True)
    last_backup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_backup_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

class DomainMapping(Base):
    __tablename__ = "domain_mappings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    domain: Mapped[str] = mapped_column(String(200), unique=True)
    verification_token: Mapped[str] = mapped_column(String(100), unique=True)
    verified: Mapped[bool] = mapped_column(default=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
