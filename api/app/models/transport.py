"""School transport: vehicles, routes and stops, who rides where, live trips, boarding and SOS."""
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Vehicle(Base, TenantMixin, TimestampMixin):
    __tablename__ = "vehicles"
    __table_args__ = (UniqueConstraint("school_id", "number", name="uq_vehicle_number"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    number: Mapped[str] = mapped_column(String(20))  # registration, e.g. PB01 AB 1234
    model: Mapped[str | None] = mapped_column(String(100))
    capacity: Mapped[int] = mapped_column(Integer, default=40)
    driver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    helper_name: Mapped[str | None] = mapped_column(String(100))
    helper_phone: Mapped[str | None] = mapped_column(String(20))
    insurance_until: Mapped[date | None] = mapped_column(Date)
    fitness_until: Mapped[date | None] = mapped_column(Date)
    permit_until: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Route(Base, TenantMixin, TimestampMixin):
    __tablename__ = "routes"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"))
    monthly_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Stop(Base, TenantMixin):
    __tablename__ = "stops"

    id: Mapped[uuid.UUID] = uuid_pk()
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    pickup_time: Mapped[time | None] = mapped_column(Time)
    drop_time: Mapped[time | None] = mapped_column(Time)


class TransportAssignment(Base, TenantMixin, TimestampMixin):
    """Which route and stop a student uses (one at a time)."""
    __tablename__ = "transport_assignments"
    __table_args__ = (UniqueConstraint("student_id", name="uq_transport_student"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"))
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), index=True)
    stop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("stops.id", ondelete="SET NULL"))


class Trip(Base, TenantMixin):
    """One run of a route: morning pickup or afternoon drop. The driver's phone sends its position."""
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = uuid_pk()
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), index=True)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"))
    driver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    direction: Mapped[str] = mapped_column(String(10))  # pickup | drop
    status: Mapped[str] = mapped_column(String(10), default="running", index=True)  # running | completed
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_lat: Mapped[float | None] = mapped_column(Float)
    last_lng: Mapped[float | None] = mapped_column(Float)
    last_speed: Mapped[float | None] = mapped_column(Float)  # km/h
    last_ping_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TripPing(Base, TenantMixin):
    __tablename__ = "trip_pings"

    id: Mapped[uuid.UUID] = uuid_pk()
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    speed: Mapped[float | None] = mapped_column(Float)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Boarding(Base, TenantMixin):
    __tablename__ = "boardings"
    __table_args__ = (UniqueConstraint("trip_id", "student_id", "event", name="uq_boarding"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    event: Mapped[str] = mapped_column(String(10))  # boarded | dropped | absent
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SosAlert(Base, TenantMixin):
    __tablename__ = "sos_alerts"

    id: Mapped[uuid.UUID] = uuid_pk()
    trip_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"))
    raised_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    message: Mapped[str | None] = mapped_column(Text)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    resolution: Mapped[str | None] = mapped_column(String(300))
