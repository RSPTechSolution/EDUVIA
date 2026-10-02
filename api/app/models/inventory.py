import uuid
from decimal import Decimal
from datetime import date
from sqlalchemy import String, ForeignKey, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(20))  # pieces|kg|litre|box
    current_stock: Mapped[int] = mapped_column(default=0)
    reorder_level: Mapped[int] = mapped_column(default=10)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)

class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    purchase_date: Mapped[date] = mapped_column(Date)
    purchase_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    current_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    qr_code: Mapped[str] = mapped_column(String(200), unique=True)
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
