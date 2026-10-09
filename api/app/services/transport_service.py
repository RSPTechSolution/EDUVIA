"""Transport: fleet and routes for the transport office; trips, boarding and SOS from the driver app; live tracking for
the office and for families."""
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import Role, has_permission
from app.models import (
    Boarding, Route, SchoolClass, Section, SosAlert, Stop, Student, StudentGuardian, TransportAssignment, Trip, TripPing, User, Vehicle,
)
from app.schemas.transport import (
    ChildTransport, DriverToday, RouteIn, RouteOut, Rider, SosOut, StopOut, TripDetail, TripOut, TripRider, VehicleIn, VehicleOut,
)
from app.services import audit_service, notification_service, sms_service
from app.services.academics_service import field_error
from app.services.family_service import own_students, school_today

STALE = timedelta(minutes=3)


def _t(v) -> str | None:
    return v.strftime("%H:%M") if v else None


# ---- vehicles ---------------------------------------------------------------------------------

async def _vehicles_out(db: AsyncSession, school_id: uuid.UUID, rows: list[Vehicle]) -> list[VehicleOut]:
    today = await school_today(db, school_id)
    drivers = {u.id: u for u in (await db.scalars(select(User).where(User.id.in_({v.driver_id for v in rows if v.driver_id})))).all()}
    routes: dict[uuid.UUID, list[str]] = {}
    riders: dict[uuid.UUID, int] = {}
    for vid, rname, n in (await db.execute(select(Route.vehicle_id, Route.name, func.count(TransportAssignment.id))
                                           .outerjoin(TransportAssignment, TransportAssignment.route_id == Route.id)
                                           .where(Route.school_id == school_id, Route.vehicle_id.is_not(None)).group_by(Route.vehicle_id, Route.name))).all():
        routes.setdefault(vid, []).append(rname)
        riders[vid] = riders.get(vid, 0) + n
    out = []
    for v in rows:
        d = drivers.get(v.driver_id)
        expiring = [label for label, when in (("Insurance", v.insurance_until), ("Fitness", v.fitness_until), ("Permit", v.permit_until))
                    if when and when <= today + timedelta(days=30)]
        out.append(VehicleOut(id=v.id, number=v.number, model=v.model, capacity=v.capacity, driver_id=v.driver_id, driver_name=d.full_name if d else None,
                              driver_phone=d.phone if d else None, helper_name=v.helper_name, helper_phone=v.helper_phone,
                              insurance_until=v.insurance_until, fitness_until=v.fitness_until, permit_until=v.permit_until, is_active=v.is_active,
                              routes=sorted(routes.get(v.id, [])), riders=riders.get(v.id, 0), expiring=expiring))
    return out


async def list_vehicles(db: AsyncSession, user: User) -> list[VehicleOut]:
    rows = (await db.scalars(select(Vehicle).where(Vehicle.school_id == user.school_id).order_by(Vehicle.number))).all()
    return await _vehicles_out(db, user.school_id, list(rows))


async def _check_driver(db: AsyncSession, school_id: uuid.UUID, driver_id: uuid.UUID | None) -> None:
    if driver_id and not await db.scalar(select(User.id).where(User.id == driver_id, User.school_id == school_id, User.role == Role.DRIVER,
                                                               User.is_active.is_(True))):
        raise field_error("driver_id", "Choose an active driver")


async def save_vehicle(db: AsyncSession, user: User, data: VehicleIn, vid: uuid.UUID | None = None) -> VehicleOut:
    await _check_driver(db, user.school_id, data.driver_id)
    clash = await db.scalar(select(Vehicle.id).where(Vehicle.school_id == user.school_id, Vehicle.number == data.number, Vehicle.id != vid))
    if clash:
        raise field_error("number", "A vehicle with this number already exists")
    if vid:
        v = await db.scalar(select(Vehicle).where(Vehicle.id == vid, Vehicle.school_id == user.school_id))
        if not v:
            raise NotFound("Vehicle not found")
        for k, val in data.model_dump().items():
            setattr(v, k, val)
    else:
        v = Vehicle(school_id=user.school_id, **data.model_dump())
        db.add(v)
    await db.flush()
    return (await _vehicles_out(db, user.school_id, [v]))[0]


async def delete_vehicle(db: AsyncSession, user: User, vid: uuid.UUID) -> None:
    v = await db.scalar(select(Vehicle).where(Vehicle.id == vid, Vehicle.school_id == user.school_id))
    if not v:
        raise NotFound("Vehicle not found")
    await db.delete(v)


# ---- routes -----------------------------------------------------------------------------------

async def _routes_out(db: AsyncSession, school_id: uuid.UUID, rows: list[Route]) -> list[RouteOut]:
    ids = [r.id for r in rows]
    stops: dict[uuid.UUID, list[Stop]] = {}
    for s in (await db.scalars(select(Stop).where(Stop.route_id.in_(ids)).order_by(Stop.sort_order))).all():
        stops.setdefault(s.route_id, []).append(s)
    per_stop = dict((await db.execute(select(TransportAssignment.stop_id, func.count()).where(TransportAssignment.route_id.in_(ids))
                                      .group_by(TransportAssignment.stop_id))).all())
    per_route = dict((await db.execute(select(TransportAssignment.route_id, func.count()).where(TransportAssignment.route_id.in_(ids))
                                       .group_by(TransportAssignment.route_id))).all())
    vehicles = {v.id: v for v in (await db.scalars(select(Vehicle).where(Vehicle.id.in_({r.vehicle_id for r in rows if r.vehicle_id})))).all()}
    drivers = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_({v.driver_id for v in vehicles.values() if v.driver_id})))).all())
    out = []
    for r in rows:
        v = vehicles.get(r.vehicle_id)
        out.append(RouteOut(id=r.id, name=r.name, vehicle_id=r.vehicle_id, vehicle_number=v.number if v else None,
                            driver_name=drivers.get(v.driver_id) if v else None, monthly_fee=r.monthly_fee, is_active=r.is_active,
                            stops=[StopOut(id=s.id, name=s.name, sort_order=s.sort_order, lat=s.lat, lng=s.lng, pickup_time=_t(s.pickup_time),
                                           drop_time=_t(s.drop_time), riders=per_stop.get(s.id, 0)) for s in stops.get(r.id, [])],
                            riders=per_route.get(r.id, 0), capacity=v.capacity if v else None))
    return out


async def list_routes(db: AsyncSession, user: User) -> list[RouteOut]:
    rows = (await db.scalars(select(Route).where(Route.school_id == user.school_id).order_by(Route.name))).all()
    return await _routes_out(db, user.school_id, list(rows))


async def _route(db: AsyncSession, school_id: uuid.UUID, rid: uuid.UUID) -> Route:
    r = await db.scalar(select(Route).where(Route.id == rid, Route.school_id == school_id))
    if not r:
        raise NotFound("Route not found")
    return r


async def save_route(db: AsyncSession, user: User, data: RouteIn, rid: uuid.UUID | None = None) -> RouteOut:
    if data.vehicle_id and not await db.scalar(select(Vehicle.id).where(Vehicle.id == data.vehicle_id, Vehicle.school_id == user.school_id)):
        raise field_error("vehicle_id", "Choose a vehicle from your school")
    names = [s.name.lower() for s in data.stops]
    if len(set(names)) != len(names):
        raise field_error("stops", "Two stops have the same name")
    if rid:
        r = await _route(db, user.school_id, rid)
        r.name, r.vehicle_id, r.monthly_fee, r.is_active = data.name, data.vehicle_id, data.monthly_fee, data.is_active
    else:
        r = Route(school_id=user.school_id, name=data.name, vehicle_id=data.vehicle_id, monthly_fee=data.monthly_fee, is_active=data.is_active)
        db.add(r)
        await db.flush()
    # Stops are matched by name so students keep their stop when the list is edited.
    existing = {s.name.lower(): s for s in (await db.scalars(select(Stop).where(Stop.route_id == r.id))).all()}
    keep = set()
    for i, s in enumerate(data.stops):
        row = existing.get(s.name.lower()) or Stop(school_id=user.school_id, route_id=r.id)
        row.name, row.sort_order, row.lat, row.lng, row.pickup_time, row.drop_time = s.name, i, s.lat, s.lng, s.pickup_time, s.drop_time
        db.add(row)
        keep.add(s.name.lower())
    for name, row in existing.items():
        if name not in keep:
            await db.delete(row)
    await db.flush()
    await audit_service.record(db, "transport.route", school_id=user.school_id, user_id=user.id, entity_type="route", entity_id=r.id,
                               meta={"name": r.name, "stops": len(data.stops)})
    return (await _routes_out(db, user.school_id, [r]))[0]


async def delete_route(db: AsyncSession, user: User, rid: uuid.UUID) -> None:
    await db.delete(await _route(db, user.school_id, rid))


# ---- riders -----------------------------------------------------------------------------------

async def _riders(db: AsyncSession, school_id: uuid.UUID, route_id: uuid.UUID) -> list[Rider]:
    rows = (await db.execute(select(Student, TransportAssignment.stop_id, Stop.name, Stop.sort_order, SchoolClass.name, Section.name)
                             .join(TransportAssignment, TransportAssignment.student_id == Student.id)
                             .outerjoin(Stop, Stop.id == TransportAssignment.stop_id)
                             .join(SchoolClass, SchoolClass.id == Student.class_id).join(Section, Section.id == Student.section_id)
                             .where(TransportAssignment.route_id == route_id, Student.status == "active")
                             .order_by(Stop.sort_order.nulls_last(), Student.first_name))).all()
    phones = {}
    for sid, phone in (await db.execute(select(StudentGuardian.student_id, User.phone).join(User, User.id == StudentGuardian.user_id)
                                        .where(StudentGuardian.student_id.in_([r[0].id for r in rows]), User.phone.is_not(None))
                                        .order_by(StudentGuardian.is_primary.desc()))).all():
        phones.setdefault(sid, phone)
    return [Rider(student_id=s.id, name=f"{s.first_name} {s.last_name}", class_section=f"{c} – {sec}", stop_id=stop_id, stop_name=stop_name,
                  parent_phone=phones.get(s.id)) for s, stop_id, stop_name, _, c, sec in rows]


async def riders(db: AsyncSession, user: User, route_id: uuid.UUID) -> list[Rider]:
    await _route(db, user.school_id, route_id)
    return await _riders(db, user.school_id, route_id)


async def assign(db: AsyncSession, user: User, student_id: uuid.UUID, route_id: uuid.UUID | None, stop_id: uuid.UUID | None) -> None:
    s = await db.scalar(select(Student).where(Student.id == student_id, Student.school_id == user.school_id))
    if not s:
        raise NotFound("Student not found")
    current = await db.scalar(select(TransportAssignment).where(TransportAssignment.student_id == s.id))
    if route_id is None:
        if current:
            await db.delete(current)
        return
    r = await _route(db, user.school_id, route_id)
    if stop_id and not await db.scalar(select(Stop.id).where(Stop.id == stop_id, Stop.route_id == r.id)):
        raise field_error("stop_id", "Choose a stop on this route")
    if r.vehicle_id and (not current or current.route_id != r.id):
        cap = await db.scalar(select(Vehicle.capacity).where(Vehicle.id == r.vehicle_id))
        n = await db.scalar(select(func.count()).select_from(TransportAssignment).where(TransportAssignment.route_id == r.id)) or 0
        if cap and n >= cap:
            raise AppError(f"The bus on {r.name} is full ({cap} seats)", code="ROUTE_FULL", status_code=409)
    if current:
        current.route_id, current.stop_id = r.id, stop_id
    else:
        db.add(TransportAssignment(school_id=user.school_id, student_id=s.id, route_id=r.id, stop_id=stop_id))
    await db.flush()


# ---- trips ------------------------------------------------------------------------------------

async def _trip_out(db: AsyncSession, t: Trip, with_path: bool = False) -> TripOut:
    route = await db.get(Route, t.route_id)
    vehicle = await db.get(Vehicle, t.vehicle_id) if t.vehicle_id else None
    driver = await db.get(User, t.driver_id) if t.driver_id else None
    events = (await db.execute(select(Boarding.student_id, Boarding.event).where(Boarding.trip_id == t.id))).all()
    boarded = {s for s, e in events if e == "boarded"}
    dropped = {s for s, e in events if e == "dropped"}
    total = await db.scalar(select(func.count()).select_from(TransportAssignment).where(TransportAssignment.route_id == t.route_id)) or 0
    path = []
    if with_path:
        pings = (await db.scalars(select(TripPing).where(TripPing.trip_id == t.id).order_by(TripPing.at.desc()).limit(300))).all()
        path = [[p.lat, p.lng] for p in reversed(pings)]
    stops = (await _routes_out(db, t.school_id, [route]))[0].stops if route else []
    now = datetime.now(UTC)
    return TripOut(id=t.id, route_id=t.route_id, route_name=route.name if route else "", vehicle_number=vehicle.number if vehicle else None,
                   driver_name=driver.full_name if driver else None, driver_phone=driver.phone if driver else None, direction=t.direction,
                   status=t.status, started_at=t.started_at, ended_at=t.ended_at, lat=t.last_lat, lng=t.last_lng, speed=t.last_speed,
                   last_ping_at=t.last_ping_at, stale=t.status == "running" and (t.last_ping_at is None or now - t.last_ping_at > STALE),
                   on_board=len(boarded - dropped), riders=total, stops=stops, path=path)


async def _detail(db: AsyncSession, t: Trip) -> TripDetail:
    base = await _trip_out(db, t, with_path=True)
    events = {}
    for sid, ev, at in (await db.execute(select(Boarding.student_id, Boarding.event, Boarding.at).where(Boarding.trip_id == t.id))).all():
        events.setdefault(sid, {})[ev] = at
    roster = [TripRider(**r.model_dump(), boarded_at=events.get(r.student_id, {}).get("boarded"),
                        dropped_at=events.get(r.student_id, {}).get("dropped"), absent="absent" in events.get(r.student_id, {}))
              for r in await _riders(db, t.school_id, t.route_id)]
    return TripDetail(**base.model_dump(), roster=roster)


async def _driver_vehicle(db: AsyncSession, user: User) -> Vehicle | None:
    return await db.scalar(select(Vehicle).where(Vehicle.school_id == user.school_id, Vehicle.driver_id == user.id, Vehicle.is_active.is_(True)))


async def driver_today(db: AsyncSession, user: User) -> DriverToday:
    v = await _driver_vehicle(db, user)
    routes = list((await db.scalars(select(Route).where(Route.vehicle_id == v.id, Route.is_active.is_(True)).order_by(Route.name))).all()) if v else []
    running = await db.scalar(select(Trip).where(Trip.driver_id == user.id, Trip.status == "running").order_by(Trip.started_at.desc()))
    return DriverToday(vehicle=(await _vehicles_out(db, user.school_id, [v]))[0] if v else None,
                       routes=await _routes_out(db, user.school_id, routes), running=await _detail(db, running) if running else None)


async def start_trip(db: AsyncSession, user: User, route_id: uuid.UUID, direction: str) -> TripDetail:
    r = await _route(db, user.school_id, route_id)
    v = await db.get(Vehicle, r.vehicle_id) if r.vehicle_id else None
    if not has_permission(user.role, "transport.manage") and (not v or v.driver_id != user.id):
        raise Forbidden("This route isn't assigned to your vehicle", code="NOT_YOUR_ROUTE")
    if await db.scalar(select(Trip.id).where(Trip.route_id == r.id, Trip.status == "running")):
        raise AppError("A trip on this route is already running", code="TRIP_RUNNING", status_code=409)
    t = Trip(school_id=user.school_id, route_id=r.id, vehicle_id=v.id if v else None, driver_id=user.id, direction=direction)
    db.add(t)
    await db.flush()
    await db.refresh(t)
    await notification_service.notify(db, await notification_service.family_of(db, [x.student_id for x in await _riders(db, user.school_id, r.id)]),
                                      school_id=user.school_id, kind="transport",
                                      title=f"Bus {'started for school' if direction == 'pickup' else 'has left school'}: {r.name}",
                                      body="Track it live in the app.", link="/my-transport", data={"trip_id": t.id})
    return await _detail(db, t)


async def _trip(db: AsyncSession, user: User, tid: uuid.UUID, running: bool = True) -> Trip:
    t = await db.scalar(select(Trip).where(Trip.id == tid, Trip.school_id == user.school_id))
    if not t:
        raise NotFound("Trip not found")
    if t.driver_id != user.id and not has_permission(user.role, "transport.manage"):
        raise Forbidden("This isn't your trip", code="NOT_YOUR_TRIP")
    if running and t.status != "running":
        raise AppError("This trip has ended", code="TRIP_ENDED", status_code=409)
    return t


async def ping(db: AsyncSession, user: User, tid: uuid.UUID, lat: float, lng: float, speed: float | None) -> dict:
    t = await _trip(db, user, tid)
    now = datetime.now(UTC)
    t.last_lat, t.last_lng, t.last_speed, t.last_ping_at = lat, lng, speed, now
    db.add(TripPing(school_id=t.school_id, trip_id=t.id, lat=lat, lng=lng, speed=speed, at=now))
    await db.flush()
    return {"ok": True}


async def board(db: AsyncSession, user: User, tid: uuid.UUID, student_id: uuid.UUID, ev: str) -> TripDetail:
    t = await _trip(db, user, tid)
    rider = next((r for r in await _riders(db, t.school_id, t.route_id) if r.student_id == student_id), None)
    if not rider:
        raise field_error("student_id", "This student doesn't ride this route")
    existing = await db.scalar(select(Boarding).where(Boarding.trip_id == t.id, Boarding.student_id == student_id, Boarding.event == ev))
    if not existing:
        if ev == "dropped" and not await db.scalar(select(Boarding.id).where(Boarding.trip_id == t.id, Boarding.student_id == student_id,
                                                                               Boarding.event == "boarded")):
            raise AppError("Mark the student as boarded first", code="NOT_BOARDED", status_code=409)
        db.add(Boarding(school_id=t.school_id, trip_id=t.id, student_id=student_id, event=ev))
        await db.flush()
        route = await db.get(Route, t.route_id)
        when = datetime.now(UTC)
        text = {"boarded": f"{rider.name} boarded the bus", "dropped": f"{rider.name} got off the bus" + (f" at {rider.stop_name}" if rider.stop_name and t.direction == "drop" else " at school"),
                "absent": f"{rider.name} didn't come to the bus stop"}[ev]
        await notification_service.notify(db, await notification_service.family_of(db, [student_id]), school_id=t.school_id, kind="transport",
                                          title=text, body=f"{route.name if route else ''} · {when:%H:%M} UTC", link="/my-transport",
                                          data={"trip_id": t.id, "event": ev})
        await sms_service.queue(db, school_id=t.school_id, event_name="transport", phones=await sms_service.family_phones(db, [student_id]),
                                body=f"{text} ({route.name if route else 'school bus'}).")
    return await _detail(db, t)


async def end_trip(db: AsyncSession, user: User, tid: uuid.UUID) -> TripDetail:
    t = await _trip(db, user, tid)
    t.status, t.ended_at = "completed", datetime.now(UTC)
    await db.flush()
    return await _detail(db, t)


async def trip_detail(db: AsyncSession, user: User, tid: uuid.UUID) -> TripDetail:
    return await _detail(db, await _trip(db, user, tid, running=False))


async def live(db: AsyncSession, user: User) -> list[TripOut]:
    rows = (await db.scalars(select(Trip).where(Trip.school_id == user.school_id, Trip.status == "running").order_by(Trip.started_at))).all()
    return [await _trip_out(db, t, with_path=True) for t in rows]


async def history(db: AsyncSession, user: User, day: date) -> list[TripOut]:
    start = datetime.combine(day, datetime.min.time(), tzinfo=UTC) - timedelta(hours=6)
    rows = (await db.scalars(select(Trip).where(Trip.school_id == user.school_id, Trip.started_at >= start,
                                                Trip.started_at < start + timedelta(days=1)).order_by(Trip.started_at.desc()))).all()
    return [await _trip_out(db, t) for t in rows]


async def family(db: AsyncSession, user: User) -> list[ChildTransport]:
    out = []
    today = await school_today(db, user.school_id)
    since = datetime.combine(today, datetime.min.time(), tzinfo=UTC) - timedelta(hours=6)
    for kid in await own_students(db, user):
        a = await db.scalar(select(TransportAssignment).where(TransportAssignment.student_id == kid.id))
        if not a:
            out.append(ChildTransport(student_id=kid.id, name=f"{kid.first_name} {kid.last_name}", route=None, stop=None, trip=None, today=[]))
            continue
        route = await db.get(Route, a.route_id)
        ro = (await _routes_out(db, user.school_id, [route]))[0]
        trip = await db.scalar(select(Trip).where(Trip.route_id == route.id, Trip.status == "running").order_by(Trip.started_at.desc()))
        events = (await db.execute(select(Boarding.event, Boarding.at, Trip.direction).join(Trip, Trip.id == Boarding.trip_id)
                                   .where(Boarding.student_id == kid.id, Boarding.at >= since).order_by(Boarding.at))).all()
        out.append(ChildTransport(student_id=kid.id, name=f"{kid.first_name} {kid.last_name}", route=ro,
                                  stop=next((s for s in ro.stops if s.id == a.stop_id), None),
                                  trip=await _trip_out(db, trip, with_path=True) if trip else None,
                                  today=[{"event": e, "at": at.isoformat(), "direction": d} for e, at, d in events]))
    return out


# ---- SOS --------------------------------------------------------------------------------------

async def sos(db: AsyncSession, user: User, tid: uuid.UUID | None, lat: float | None, lng: float | None, message: str | None) -> SosOut:
    t = await _trip(db, user, tid) if tid else await db.scalar(select(Trip).where(Trip.driver_id == user.id, Trip.status == "running"))
    a = SosAlert(school_id=user.school_id, trip_id=t.id if t else None, raised_by=user.id, lat=lat or (t.last_lat if t else None),
                 lng=lng or (t.last_lng if t else None), message=message)
    db.add(a)
    await db.flush()
    await db.refresh(a)
    office = (await db.scalars(select(User.id).where(User.school_id == user.school_id, User.is_active.is_(True),
                                                     User.role.in_([Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TRANSPORT_MANAGER])))).all()
    route = await db.get(Route, t.route_id) if t else None
    await notification_service.notify(db, office, school_id=user.school_id, kind="sos", title=f"SOS from {user.full_name}",
                                      body=f"{route.name if route else 'School bus'}: {message or 'Needs help now'}", link="/transport?tab=sos",
                                      data={"sos_id": a.id})
    phones = (await db.scalars(select(User.phone).where(User.id.in_(office), User.phone.is_not(None)))).all()
    await sms_service.queue(db, school_id=user.school_id, event_name="sos", phones=phones, force=["sms"],
                            body=f"SOS: {user.full_name} ({route.name if route else 'school bus'}) needs help. {message or ''} "
                                 + (f"https://maps.google.com/?q={a.lat},{a.lng}" if a.lat else ""))
    await audit_service.record(db, "transport.sos", school_id=user.school_id, user_id=user.id, entity_type="sos", entity_id=a.id,
                               meta={"message": message})
    return (await _sos_out(db, [a]))[0]


async def _sos_out(db: AsyncSession, rows: list[SosAlert]) -> list[SosOut]:
    out = []
    for a in rows:
        t = await db.get(Trip, a.trip_id) if a.trip_id else None
        route = await db.get(Route, t.route_id) if t else None
        v = await db.get(Vehicle, t.vehicle_id) if t and t.vehicle_id else None
        u = await db.get(User, a.raised_by) if a.raised_by else None
        out.append(SosOut(id=a.id, route_name=route.name if route else None, vehicle_number=v.number if v else None, raised_by=u.full_name if u else None,
                          phone=u.phone if u else None, lat=a.lat, lng=a.lng, message=a.message, raised_at=a.raised_at, resolved_at=a.resolved_at,
                          resolution=a.resolution))
    return out


async def list_sos(db: AsyncSession, user: User) -> list[SosOut]:
    rows = (await db.scalars(select(SosAlert).where(SosAlert.school_id == user.school_id).order_by(SosAlert.raised_at.desc()).limit(50))).all()
    return await _sos_out(db, list(rows))


async def resolve_sos(db: AsyncSession, user: User, sid: uuid.UUID, resolution: str) -> SosOut:
    a = await db.scalar(select(SosAlert).where(SosAlert.id == sid, SosAlert.school_id == user.school_id))
    if not a:
        raise NotFound("Alert not found")
    a.resolved_at, a.resolved_by, a.resolution = datetime.now(UTC), user.id, resolution
    await db.flush()
    return (await _sos_out(db, [a]))[0]
