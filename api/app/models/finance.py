"""Fee categories, per-class fee structures, invoices, payments and online payment orders."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk

Money = Numeric(12, 2)


class FeeCategory(Base, TenantMixin, TimestampMixin):
    """A kind of charge: tuition, transport, exam fee..."""
    __tablename__ = "fee_categories"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_fee_category_name"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class FeeStructure(Base, TenantMixin, TimestampMixin):
    """How much a class pays for a category in each billing term."""
    __tablename__ = "fee_structures"
    __table_args__ = (UniqueConstraint("class_id", "category_id", name="uq_fee_structure"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_categories.id", ondelete="CASCADE"))
    amount: Mapped[Decimal] = mapped_column(Money)


class FeeInvoice(Base, TenantMixin, TimestampMixin):
    """A bill for one student for one term."""
    __tablename__ = "fee_invoices"
    __table_args__ = (
        UniqueConstraint("school_id", "invoice_no", name="uq_invoice_no"),
        UniqueConstraint("student_id", "term", name="uq_invoice_student_term"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    invoice_no: Mapped[str] = mapped_column(String(30))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    term: Mapped[str] = mapped_column(String(100))  # "Quarter 3 (Oct–Dec) 2026-27"
    academic_year: Mapped[str] = mapped_column(String(10))  # "2026-27"
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    total: Mapped[Decimal] = mapped_column(Money)
    discount: Mapped[Decimal] = mapped_column(Money, default=0)
    discount_reason: Mapped[str | None] = mapped_column(String(200))
    paid: Mapped[Decimal] = mapped_column(Money, default=0)
    status: Mapped[str] = mapped_column(String(20), default="unpaid", index=True)  # unpaid | partial | paid | cancelled


class FeeInvoiceItem(Base, TenantMixin):
    __tablename__ = "fee_invoice_items"

    id: Mapped[uuid.UUID] = uuid_pk()
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_invoices.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_categories.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(100))  # kept even if the category is renamed later
    amount: Mapped[Decimal] = mapped_column(Money)


class FeePayment(Base, TenantMixin):
    """Money received against an invoice. Never edited; mistakes are reversed with a refund entry later."""
    __tablename__ = "fee_payments"
    __table_args__ = (UniqueConstraint("school_id", "receipt_no", name="uq_receipt_no"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    receipt_no: Mapped[str] = mapped_column(String(30))
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_invoices.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Money)
    method: Mapped[str] = mapped_column(String(20))  # cash | upi | cheque | card | bank_transfer | online
    reference: Mapped[str | None] = mapped_column(String(100))  # cheque no, UPI ref, gateway payment id
    note: Mapped[str | None] = mapped_column(String(200))
    collected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    paid_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))  # parent paying online
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class PaymentOrder(Base, TenantMixin, TimestampMixin):
    """An online payment attempt. Becomes a FeePayment only once the gateway confirms it."""
    __tablename__ = "payment_orders"

    id: Mapped[uuid.UUID] = uuid_pk()
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_invoices.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Money)
    gateway: Mapped[str] = mapped_column(String(20))  # test | razorpay
    gateway_order_id: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), default="created")  # created | paid | failed
    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_payments.id", ondelete="SET NULL"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
