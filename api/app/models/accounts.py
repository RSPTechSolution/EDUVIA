"""School accounts: income and expense heads, and the day book of entries (fees are counted from fee payments)."""
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class LedgerHead(Base, TenantMixin, TimestampMixin):
    """An income or expense head, e.g. "Salaries", "Electricity", "Canteen rent"."""
    __tablename__ = "ledger_heads"
    __table_args__ = (UniqueConstraint("school_id", "kind", "name", name="uq_ledger_head"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    kind: Mapped[str] = mapped_column(String(10))  # income | expense
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AccountEntry(Base, TenantMixin, TimestampMixin):
    """Money in or out that isn't a fee payment: a voucher in the day book."""
    __tablename__ = "account_entries"
    __table_args__ = (UniqueConstraint("school_id", "voucher_no", name="uq_voucher_no"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    voucher_no: Mapped[str] = mapped_column(String(30))
    kind: Mapped[str] = mapped_column(String(10), index=True)  # income | expense
    head_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ledger_heads.id", ondelete="RESTRICT"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    party: Mapped[str | None] = mapped_column(String(200))  # paid to / received from
    method: Mapped[str] = mapped_column(String(20))  # cash | bank_transfer | upi | cheque | card
    reference: Mapped[str | None] = mapped_column(String(100))
    note: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
