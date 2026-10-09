"""Vehicles, routes, stops, assignments, trips, boarding, SOS."""
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints

Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
Lat = Annotated[float, Field(ge=-90, le=90)]
Lng = Annotated[float, Field(ge=-180, le=180)]


class VehicleIn(BaseModel):
    number: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=4, max_length=20)]
    model: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    capacity: int = Field(40, ge=1, le=120)
    driver_id: uuid.UUID | None = None
    helper_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    helper_phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None
    insurance_until: date | None = None
    fitness_until: date | None = None
    permit_until: date | None = None
    is_active: bool = True


class VehicleOut(BaseModel):
    id: uuid.UUID
    number: str
    model: str | None
    capacity: int
    driver_id: uuid.UUID | None
    driver_name: str | None
    driver_phone: str | None
    helper_name: str | None
    helper_phone: str | None
    insurance_until: date | None
    fitness_until: date | None
    permit_until: date | None
    is_active: bool
    routes: list[str] = []
    riders: int = 0
    expiring: list[str] = []  # "Insurance", "Fitness" ... due within 30 days or past


class StopIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    lat: Lat | None = None
    lng: Lng | None = None
    pickup_time: time | None = None
    drop_time: time | None = None


class RouteIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    vehicle_id: uuid.UUID | None = None
    monthly_fee: Annotated[Decimal, Field(ge=0, le=100000, decimal_places=2)] = Decimal(0)
    is_active: bool = True
    stops: list[StopIn] = Field(default_factory=list, max_length=60)


class StopOut(BaseModel):
    id: uuid.UUID
    name: str
    sort_order: int
    lat: float | None
    lng: float | None
    pickup_time: str | None
    drop_time: str | None
    riders: int = 0


class RouteOut(BaseModel):
    id: uuid.UUID
    name: str
    vehicle_id: uuid.UUID | None
    vehicle_number: str | None
    driver_name: str | None
    monthly_fee: Num
    is_active: bool
    stops: list[StopOut]
    riders: int
    capacity: int | None


class AssignIn(BaseModel):
    student_id: uuid.UUID
    route_id: uuid.UUID | None  # None removes the student from transport
    stop_id: uuid.UUID | None = None


class Rider(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    stop_id: uuid.UUID | None
    stop_name: str | None
    parent_phone: str | None


class TripStart(BaseModel):
    route_id: uuid.UUID
    direction: Literal["pickup", "drop"]


class Ping(BaseModel):
    lat: Lat
    lng: Lng
    speed: Annotated[float, Field(ge=0, le=200)] | None = None


class BoardIn(BaseModel):
    student_id: uuid.UUID
    event: Literal["boarded", "dropped", "absent"]


class SosIn(BaseModel):
    lat: Lat | None = None
    lng: Lng | None = None
    message: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


class TripRider(Rider):
    boarded_at: datetime | None
    dropped_at: datetime | None
    absent: bool


class TripOut(BaseModel):
    id: uuid.UUID
    route_id: uuid.UUID
    route_name: str
    vehicle_number: str | None
    driver_name: str | None
    driver_phone: str | None
    direction: str
    status: str
    started_at: datetime
    ended_at: datetime | None
    lat: float | None
    lng: float | None
    speed: float | None
    last_ping_at: datetime | None
    stale: bool  # no position for 3+ minutes while running
    on_board: int
    riders: int
    stops: list[StopOut] = []
    path: list[list[float]] = []  # recent [lat, lng]


class TripDetail(TripOut):
    roster: list[TripRider]


class DriverToday(BaseModel):
    vehicle: VehicleOut | None
    routes: list[RouteOut]
    running: TripDetail | None


class ChildTransport(BaseModel):
    student_id: uuid.UUID
    name: str
    route: RouteOut | None
    stop: StopOut | None
    trip: TripOut | None  # today's running trip on the route
    today: list[dict]  # [{event, at, direction}]


class SosOut(BaseModel):
    id: uuid.UUID
    route_name: str | None
    vehicle_number: str | None
    raised_by: str | None
    phone: str | None
    lat: float | None
    lng: float | None
    message: str | None
    raised_at: datetime
    resolved_at: datetime | None
    resolution: str | None


class Resolve(BaseModel):
    resolution: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]
