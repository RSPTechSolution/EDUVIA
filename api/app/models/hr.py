import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Staff(Base):
    __tablename__ = "staff"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    employee_id: Mapped[str] = mapped_column(String(50), unique=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    account_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    documents: Mapped[list | None] = mapped_column(JSONB, nullable=True)

class LeaveType(Base):
    __tablename__ = "leave_types"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(50))
    is_paid: Mapped[bool] = mapped_column(default=True)
    days_allowed: Mapped[int] = mapped_column()

class LeaveApplication(Base):
    __tablename__ = "leave_applications"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column()
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    leave_type = relationship("LeaveType")

class SalaryStructure(Base):
    __tablename__ = "salary_structures"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    basic: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    hra: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    ta: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    da: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    pf: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    esi: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tds: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    effective_from: Mapped[date] = mapped_column(Date)

class PayrollRun(Base):
    __tablename__ = "payroll_runs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    month: Mapped[int] = mapped_column()
    year: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="draft")
    run_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("school_id", "month", "year"),)

class SalarySlip(Base):
    __tablename__ = "salary_slips"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    present_days: Mapped[int] = mapped_column()
    absent_days: Mapped[int] = mapped_column()
    leave_days: Mapped[int] = mapped_column()
    breakdown: Mapped[dict] = mapped_column(JSONB)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    staff = relationship("Staff")
