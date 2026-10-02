import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base

class Driver(Base):
    __tablename__ = "drivers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    driver_id: Mapped[str] = mapped_column(String(20), unique=True)  # e.g. DRV-00342
    pin_hash: Mapped[str] = mapped_column(String(200))
    qr_token: Mapped[str] = mapped_column(String(200), unique=True)
    license_no: Mapped[str] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(default=True)

class Route(Base):
    __tablename__ = "routes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(100))
    driver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

class RouteStop(Base):
    __tablename__ = "route_stops"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"))
    name: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 8))
    longitude: Mapped[Decimal] = mapped_column(Numeric(11, 8))
    order_index: Mapped[int] = mapped_column()
    expected_time: Mapped[str] = mapped_column(String(5))  # "07:30"

class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"))
    driver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    date: Mapped[date] = mapped_column(Date)
    direction: Mapped[str] = mapped_column(String(20))  # morning|afternoon
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class TripGpsLog(Base):
    __tablename__ = "trip_gps_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"))
    lat: Mapped[Decimal] = mapped_column(Numeric(10, 8))
    lng: Mapped[Decimal] = mapped_column(Numeric(11, 8))
    speed: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class TripBoarding(Base):
    __tablename__ = "trip_boardings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    stop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("route_stops.id"))
    status: Mapped[str] = mapped_column(String(20))  # boarded|absent|skipped
    boarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("trip_id", "student_id"),)

class Sos(Base):
    __tablename__ = "sos_alerts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    driver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"))
    lat: Mapped[Decimal] = mapped_column(Numeric(10, 8))
    lng: Mapped[Decimal] = mapped_column(Numeric(11, 8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
