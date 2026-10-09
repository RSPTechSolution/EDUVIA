"""HR and payroll: staff profiles and pay, staff attendance, leave, payroll runs and payslips."""
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk

Money = Numeric(12, 2)


class StaffProfile(Base, TenantMixin, TimestampMixin):
    """Employment and pay details for a member of staff. Monthly salary components are in rupees."""
    __tablename__ = "staff_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_staff_profile_user"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    department: Mapped[str | None] = mapped_column(String(100))
    date_of_joining: Mapped[date | None] = mapped_column(Date)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    qualification: Mapped[str | None] = mapped_column(String(200))
    pan: Mapped[str | None] = mapped_column(String(10))
    uan: Mapped[str | None] = mapped_column(String(12))  # provident fund account
    bank_name: Mapped[str | None] = mapped_column(String(100))
    bank_account: Mapped[str | None] = mapped_column(String(30))
    ifsc: Mapped[str | None] = mapped_column(String(11))
    basic: Mapped[Decimal] = mapped_column(Money, default=0)
    hra: Mapped[Decimal] = mapped_column(Money, default=0)
    da: Mapped[Decimal] = mapped_column(Money, default=0)
    conveyance: Mapped[Decimal] = mapped_column(Money, default=0)
    special: Mapped[Decimal] = mapped_column(Money, default=0)
    pf_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    esi_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    professional_tax: Mapped[Decimal] = mapped_column(Money, default=200)
    tds: Mapped[Decimal] = mapped_column(Money, default=0)  # monthly income-tax deduction


class StaffAttendance(Base, TenantMixin):
    __tablename__ = "staff_attendance"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_staff_attendance"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(10))  # present | absent | half_day | leave | late
    check_in: Mapped[time | None] = mapped_column(Time)
    check_out: Mapped[time | None] = mapped_column(Time)
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual | biometric | leave
    marked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class LeaveType(Base, TenantMixin, TimestampMixin):
    __tablename__ = "leave_types"
    __table_args__ = (UniqueConstraint("school_id", "code", name="uq_leave_type_code"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(60))  # Casual leave
    code: Mapped[str] = mapped_column(String(10))  # CL
    days_per_year: Mapped[int] = mapped_column(Integer, default=12)
    paid: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StaffLeave(Base, TenantMixin, TimestampMixin):
    __tablename__ = "staff_leaves"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id", ondelete="RESTRICT"))
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    half_day: Mapped[bool] = mapped_column(Boolean, default=False)
    days: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)  # pending | approved | rejected | cancelled
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(String(300))


class PayrollRun(Base, TenantMixin, TimestampMixin):
    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("school_id", "month", name="uq_payroll_month"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    status: Mapped[str] = mapped_column(String(10), default="draft")  # draft | finalised | paid
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    finalised_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_on: Mapped[date | None] = mapped_column(Date)


class Payslip(Base, TenantMixin):
    __tablename__ = "payslips"
    __table_args__ = (UniqueConstraint("run_id", "user_id", name="uq_payslip"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    days_in_month: Mapped[int] = mapped_column(Integer)
    paid_days: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    lop_days: Mapped[Decimal] = mapped_column(Numeric(5, 1))  # loss of pay
    earnings: Mapped[dict] = mapped_column(JSONB, default=dict)  # {name: amount}
    deductions: Mapped[dict] = mapped_column(JSONB, default=dict)
    gross: Mapped[Decimal] = mapped_column(Money)
    total_deductions: Mapped[Decimal] = mapped_column(Money)
    net: Mapped[Decimal] = mapped_column(Money)
    adjustments: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"bonus": 1000, "advance": -500}
    note: Mapped[str | None] = mapped_column(String(300))
