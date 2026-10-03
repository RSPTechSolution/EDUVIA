import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk
from app.models.billing import Plan


class School(Base, TimestampMixin):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    domain: Mapped[str | None] = mapped_column(String(200), unique=True)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    language: Mapped[str] = mapped_column(String(10), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Subscription. The plan decides which modules can be enabled and the user limits.
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"), index=True)
    plan: Mapped[Plan] = relationship(lazy="joined")
    subscription_status: Mapped[str] = mapped_column(String(20), default="active")  # trialing | active | past_due | cancelled
    billing_cycle: Mapped[str] = mapped_column(String(10), default="yearly")  # monthly | yearly
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Non-secret preferences only. Credentials live in encrypted columns (later phases).
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")


class SchoolModule(Base, TenantMixin, TimestampMixin):
    __tablename__ = "school_modules"
    __table_args__ = (UniqueConstraint("school_id", "module", name="uq_school_module"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    module: Mapped[str] = mapped_column(String(50))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
