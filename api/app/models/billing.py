import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Plan(Base, TimestampMixin):
    """A subscription plan. Platform-wide (not school-owned), so no RLS: anyone
    may read public plans; only the platform admin can change them."""
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    tagline: Mapped[str | None] = mapped_column(String(200))
    price_monthly: Mapped[int] = mapped_column(Integer)  # whole INR, excl. GST
    price_yearly: Mapped[int] = mapped_column(Integer)
    max_students: Mapped[int | None] = mapped_column(Integer)  # None = unlimited
    max_staff: Mapped[int | None] = mapped_column(Integer)
    storage_gb: Mapped[int] = mapped_column(Integer, default=10)
    modules: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    features: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    highlight: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Lead(Base):
    """Enquiries from the public website: contact form, custom-plan quotes and
    upgrade requests from existing schools."""
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = uuid_pk()
    kind: Mapped[str] = mapped_column(String(20), index=True)  # contact | quote | upgrade
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)  # new | contacted | closed
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20))
    school_name: Mapped[str | None] = mapped_column(String(200))
    message: Mapped[str | None] = mapped_column(Text)
    students: Mapped[int | None] = mapped_column(Integer)
    modules: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    quoted_monthly: Mapped[int | None] = mapped_column(Integer)
    plan_code: Mapped[str | None] = mapped_column(String(80))
    # Set for upgrade requests. Deliberately not "school_id": leads are platform data, not tenant data.
    from_school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class SubscriptionPayment(Base, TenantMixin):
    """A school paying Vidyanexa for its plan: one row per checkout. Amounts are in INR; GST (18%) is charged on top of
    the plan price and shown separately on the invoice. Only subscriptions are paid online; school fees are not."""
    __tablename__ = "subscription_payments"

    id: Mapped[uuid.UUID] = uuid_pk()
    invoice_no: Mapped[str | None] = mapped_column(String(30), unique=True)  # given once paid, e.g. VNX-2627-00001
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    plan_name: Mapped[str] = mapped_column(String(120))
    billing_cycle: Mapped[str] = mapped_column(String(10))  # monthly | yearly
    base_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 4))
    gst_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    total: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(10), default="created", index=True)  # created | paid | failed
    gateway: Mapped[str] = mapped_column(String(20))
    gateway_order_id: Mapped[str] = mapped_column(String(80))
    gateway_payment_id: Mapped[str | None] = mapped_column(String(80))
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
