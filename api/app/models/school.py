import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampMixin
from app.core.database import Base
from datetime import date
from sqlalchemy import Date

class AcademicYear(Base, TimestampMixin):
    __tablename__ = "academic_years"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(50))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True)
class School(Base, TimestampMixin):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    domain: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    language: Mapped[str] = mapped_column(String(10), default="en")
    is_active: Mapped[bool] = mapped_column(default=True)
    plan: Mapped[str] = mapped_column(String(50), default="basic")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    users = relationship("User", back_populates="school")
    modules = relationship("SchoolModule", back_populates="school")

class SchoolModule(Base, TimestampMixin):
    __tablename__ = "school_modules"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    module_name: Mapped[str] = mapped_column(String(50))
    is_enabled: Mapped[bool] = mapped_column(default=True)
    school = relationship("School", back_populates="modules")
