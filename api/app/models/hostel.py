import uuid
from datetime import date
from sqlalchemy import String, ForeignKey, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class HostelRoom(Base):
    __tablename__ = "hostel_rooms"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    block: Mapped[str] = mapped_column(String(50))
    floor: Mapped[str] = mapped_column(String(10))
    room_number: Mapped[str] = mapped_column(String(20))
    room_type: Mapped[str] = mapped_column(String(20))  # single|double|dormitory
    capacity: Mapped[int] = mapped_column()
    __table_args__ = (UniqueConstraint("school_id", "block", "floor", "room_number"),)

class HostelAllocation(Base):
    __tablename__ = "hostel_allocations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id"))
    allocated_from: Mapped[date] = mapped_column(Date)
    allocated_to: Mapped[date | None] = mapped_column(Date, nullable=True)
