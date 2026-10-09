"""Transport office, driver app and family tracking."""
import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.common import ApiResponse, Message, ok
from app.schemas.transport import (
    AssignIn, BoardIn, ChildTransport, DriverToday, Ping, Resolve, Rider, RouteIn, RouteOut, SosIn, SosOut, TripDetail, TripOut, TripStart,
    VehicleIn, VehicleOut,
)
from app.services import transport_service as svc

router = APIRouter(dependencies=[require_module("transport")])


# ---- office -----------------------------------------------------------------------------------

@router.get("/vehicles", response_model=ApiResponse[list[VehicleOut]])
async def vehicles(db: DB, current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.list_vehicles(db, current.user))


@router.post("/vehicles", response_model=ApiResponse[VehicleOut], status_code=201)
async def add_vehicle(body: VehicleIn, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    return ok(await svc.save_vehicle(db, current.user, body))


@router.put("/vehicles/{vid}", response_model=ApiResponse[VehicleOut])
async def edit_vehicle(vid: uuid.UUID, body: VehicleIn, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    return ok(await svc.save_vehicle(db, current.user, body, vid))


@router.delete("/vehicles/{vid}", response_model=ApiResponse[Message])
async def delete_vehicle(vid: uuid.UUID, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    await svc.delete_vehicle(db, current.user, vid)
    return ok(Message(message="Vehicle removed"))


@router.get("/routes", response_model=ApiResponse[list[RouteOut]])
async def routes(db: DB, current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.list_routes(db, current.user))


@router.post("/routes", response_model=ApiResponse[RouteOut], status_code=201)
async def add_route(body: RouteIn, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    return ok(await svc.save_route(db, current.user, body))


@router.put("/routes/{rid}", response_model=ApiResponse[RouteOut])
async def edit_route(rid: uuid.UUID, body: RouteIn, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    return ok(await svc.save_route(db, current.user, body, rid))


@router.delete("/routes/{rid}", response_model=ApiResponse[Message])
async def delete_route(rid: uuid.UUID, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    await svc.delete_route(db, current.user, rid)
    return ok(Message(message="Route removed"))


@router.get("/routes/{rid}/riders", response_model=ApiResponse[list[Rider]])
async def route_riders(rid: uuid.UUID, db: DB, current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.riders(db, current.user, rid))


@router.put("/assignments", response_model=ApiResponse[Message])
async def assign(body: AssignIn, db: DB, current: CurrentUser = require_permission("transport.manage")):
    current.require_school()
    await svc.assign(db, current.user, body.student_id, body.route_id, body.stop_id)
    return ok(Message(message="Saved" if body.route_id else "Removed from transport"))


@router.get("/live", response_model=ApiResponse[list[TripOut]])
async def live(db: DB, current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.live(db, current.user))


@router.get("/trips", response_model=ApiResponse[list[TripOut]])
async def trips(db: DB, on: date = Query(alias="date"), current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.history(db, current.user, on))


@router.get("/sos", response_model=ApiResponse[list[SosOut]])
async def sos_list(db: DB, current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.list_sos(db, current.user))


@router.post("/sos/{sid}/resolve", response_model=ApiResponse[SosOut])
async def resolve(sid: uuid.UUID, body: Resolve, db: DB, current: CurrentUser = require_permission("transport.view")):
    current.require_school()
    return ok(await svc.resolve_sos(db, current.user, sid, body.resolution))


# ---- driver -----------------------------------------------------------------------------------

@router.get("/driver/today", response_model=ApiResponse[DriverToday])
async def driver_today(db: DB, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.driver_today(db, current.user))


@router.post("/trips", response_model=ApiResponse[TripDetail], status_code=201)
async def start(body: TripStart, db: DB, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.start_trip(db, current.user, body.route_id, body.direction))


@router.get("/trips/{tid}", response_model=ApiResponse[TripDetail])
async def trip(tid: uuid.UUID, db: DB, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.trip_detail(db, current.user, tid))


@router.post("/trips/{tid}/ping", response_model=ApiResponse[dict])
async def ping(tid: uuid.UUID, body: Ping, db: DB, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.ping(db, current.user, tid, body.lat, body.lng, body.speed))


@router.post("/trips/{tid}/board", response_model=ApiResponse[TripDetail])
async def board(tid: uuid.UUID, body: BoardIn, db: DB, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.board(db, current.user, tid, body.student_id, body.event))


@router.post("/trips/{tid}/end", response_model=ApiResponse[TripDetail])
async def end(tid: uuid.UUID, db: DB, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.end_trip(db, current.user, tid))


@router.post("/sos", response_model=ApiResponse[SosOut], status_code=201)
async def raise_sos(body: SosIn, db: DB, trip_id: uuid.UUID | None = None, current: CurrentUser = require_permission("transport.drive")):
    current.require_school()
    return ok(await svc.sos(db, current.user, trip_id, body.lat, body.lng, body.message))


# ---- families ---------------------------------------------------------------------------------

@router.get("/my", response_model=ApiResponse[list[ChildTransport]])
async def mine(db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.family(db, current.user))


@router.get("/drivers", response_model=ApiResponse[list[dict]])
async def drivers(db: DB, current: CurrentUser = require_permission("transport.view")):
    """Active drivers, for assigning to vehicles."""
    from sqlalchemy import select

    from app.models import User
    rows = (await db.scalars(select(User).where(User.school_id == current.require_school(), User.role == "driver", User.is_active.is_(True))
                             .order_by(User.full_name))).all()
    return ok([{"id": str(u.id), "full_name": u.full_name, "phone": u.phone, "license_no": u.license_no} for u in rows])
