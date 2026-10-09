"""Library, hostel, and inventory and assets."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


# ---- library ----------------------------------------------------------------------------------

class Book(Base, TenantMixin, TimestampMixin):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(300), index=True)
    author: Mapped[str | None] = mapped_column(String(200))
    isbn: Mapped[str | None] = mapped_column(String(20), index=True)
    publisher: Mapped[str | None] = mapped_column(String(150))
    category: Mapped[str | None] = mapped_column(String(80))
    rack: Mapped[str | None] = mapped_column(String(30))


class BookCopy(Base, TenantMixin):
    __tablename__ = "book_copies"
    __table_args__ = (UniqueConstraint("school_id", "accession_no", name="uq_accession_no"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True)
    accession_no: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(10), default="available")  # available | issued | lost | damaged | withdrawn


class BookIssue(Base, TenantMixin):
    __tablename__ = "book_issues"

    id: Mapped[uuid.UUID] = uuid_pk()
    copy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("book_copies.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    issued_on: Mapped[date] = mapped_column(Date)
    due_on: Mapped[date] = mapped_column(Date, index=True)
    returned_on: Mapped[date | None] = mapped_column(Date)
    fine: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    fine_paid: Mapped[bool] = mapped_column(default=False)
    issued_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---- hostel -----------------------------------------------------------------------------------

class Hostel(Base, TenantMixin, TimestampMixin):
    __tablename__ = "hostels"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(10))  # boys | girls | mixed
    warden_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    monthly_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    address: Mapped[str | None] = mapped_column(String(300))


class HostelRoom(Base, TenantMixin):
    __tablename__ = "hostel_rooms"
    __table_args__ = (UniqueConstraint("hostel_id", "number", name="uq_hostel_room"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    hostel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostels.id", ondelete="CASCADE"), index=True)
    number: Mapped[str] = mapped_column(String(20))
    floor: Mapped[str | None] = mapped_column(String(20))
    capacity: Mapped[int] = mapped_column(Integer, default=2)


class HostelAllocation(Base, TenantMixin):
    """A student's bed. `left_on` is set when they move out; one open allocation per student."""
    __tablename__ = "hostel_allocations"

    id: Mapped[uuid.UUID] = uuid_pk()
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    from_date: Mapped[date] = mapped_column(Date)
    left_on: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(200))


# ---- inventory and assets ---------------------------------------------------------------------

class StockItem(Base, TenantMixin, TimestampMixin):
    __tablename__ = "stock_items"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_stock_item"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str | None] = mapped_column(String(80))
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    reorder_level: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    location: Mapped[str | None] = mapped_column(String(100))


class StockMove(Base, TenantMixin):
    __tablename__ = "stock_moves"

    id: Mapped[uuid.UUID] = uuid_pk()
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_items.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # in | out | adjust
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # signed: + received, - issued
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    party: Mapped[str | None] = mapped_column(String(150))  # supplier, or who it was issued to
    note: Mapped[str | None] = mapped_column(String(300))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Asset(Base, TenantMixin, TimestampMixin):
    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("school_id", "tag", name="uq_asset_tag"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tag: Mapped[str] = mapped_column(String(30))  # e.g. GV-IT-0042
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str | None] = mapped_column(String(80))
    location: Mapped[str | None] = mapped_column(String(100))
    purchased_on: Mapped[date | None] = mapped_column(Date)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    vendor: Mapped[str | None] = mapped_column(String(150))
    warranty_until: Mapped[date | None] = mapped_column(Date)
    condition: Mapped[str] = mapped_column(String(15), default="good")  # good | needs_repair | broken | disposed
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
