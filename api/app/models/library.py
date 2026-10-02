import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base

class Book(Base):
    __tablename__ = "books"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    author: Mapped[str] = mapped_column(String(200))
    publisher: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

class BookCopy(Base):
    __tablename__ = "book_copies"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id"))
    barcode: Mapped[str] = mapped_column(String(100), unique=True)
    condition: Mapped[str] = mapped_column(String(20), default="good")
    is_available: Mapped[bool] = mapped_column(default=True)

class BookIssue(Base):
    __tablename__ = "book_issues"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    copy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("book_copies.id"))
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # student or staff
    member_type: Mapped[str] = mapped_column(String(10))  # student|staff
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fine: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="issued")  # issued|returned|overdue|lost
