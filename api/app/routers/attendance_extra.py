"""School calendar, leave requests, QR scan, period-wise attendance, biometric devices (and the ADMS endpoints)."""
import uuid
from datetime import date

from fastapi import APIRouter, Query, Request
from fastapi.responses import PlainTextResponse

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.attendance_extra import (
    BiometricIds, BunkRow, DeviceIn, DeviceOut, EventIn, EventOut, LeaveDecision, LeaveIn, LeaveOut, PeriodCard, PeriodRoster, PeriodSave,
    PunchOut, ScanIn, ScanOut,
)
from app.schemas.common import ApiResponse, Message, ok
from app.services import attendance_extra_service as svc
from app.services import biometric_service

calendar = APIRouter()
leave = APIRouter(dependencies=[require_module("attendance")])
attendance = APIRouter(dependencies=[require_module("attendance")])
devices = APIRouter(dependencies=[require_module("attendance")])
iclock = APIRouter()


# ---- calendar ---------------------------------------------------------------------------------

@calendar.get("", response_model=ApiResponse[list[EventOut]])
async def events(db: DB, start: date = Query(alias="from"), end: date = Query(alias="to"), current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.list_events(db, current.user, start, end))


@calendar.post("", response_model=ApiResponse[EventOut], status_code=201)
async def add_event(body: EventIn, db: DB, current: CurrentUser = require_permission("calendar.manage")):
    current.require_school()
    return ok(await svc.create_event(db, current.user, body))


@calendar.put("/{event_id}", response_model=ApiResponse[EventOut])
async def edit_event(event_id: uuid.UUID, body: EventIn, db: DB, current: CurrentUser = require_permission("calendar.manage")):
    current.require_school()
    return ok(await svc.update_event(db, current.user, event_id, body))


@calendar.delete("/{event_id}", response_model=ApiResponse[Message])
async def remove_event(event_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("calendar.manage")):
    current.require_school()
    await svc.delete_event(db, current.user, event_id)
    return ok(Message(message="Removed from the calendar"))


# ---- leave ------------------------------------------------------------------------------------

@leave.get("", response_model=ApiResponse[list[LeaveOut]])
async def list_leave(db: DB, status: str | None = None, current: CurrentUser = require_permission("school.view")):
    """Families: their children's requests. Class teachers: their class. The office: everyone."""
    current.require_school()
    return ok(await svc.list_leave(db, current.user, status))


@leave.post("", response_model=ApiResponse[LeaveOut], status_code=201)
async def ask_leave(body: LeaveIn, db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.request_leave(db, current.user, body))


@leave.post("/{leave_id}/decide", response_model=ApiResponse[LeaveOut])
async def decide_leave(leave_id: uuid.UUID, body: LeaveDecision, db: DB, current: CurrentUser = require_permission("leave.approve")):
    current.require_school()
    return ok(await svc.decide(db, current.user, leave_id, body))


@leave.post("/{leave_id}/cancel", response_model=ApiResponse[LeaveOut])
async def cancel_leave(leave_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.cancel_leave(db, current.user, leave_id))


# ---- QR scan & period-wise --------------------------------------------------------------------

@attendance.post("/scan", response_model=ApiResponse[ScanOut])
async def scan(body: ScanIn, db: DB, current: CurrentUser = require_permission("attendance.scan")):
    current.require_school()
    return ok(await svc.scan(db, current.user, body.code))


@attendance.get("/periods", response_model=ApiResponse[list[PeriodCard]])
async def my_periods(db: DB, on: date = Query(alias="date"), current: CurrentUser = require_permission("attendance.mark")):
    current.require_school()
    return ok(await svc.my_periods(db, current.user, on))


@attendance.get("/periods/{entry_id}", response_model=ApiResponse[PeriodRoster])
async def period_roster(entry_id: uuid.UUID, db: DB, on: date = Query(alias="date"), current: CurrentUser = require_permission("attendance.mark")):
    current.require_school()
    return ok(await svc.period_roster(db, current.user, entry_id, on))


@attendance.put("/periods/{entry_id}", response_model=ApiResponse[PeriodRoster])
async def save_period(entry_id: uuid.UUID, body: PeriodSave, db: DB, current: CurrentUser = require_permission("attendance.mark")):
    current.require_school()
    return ok(await svc.save_period(db, current.user, entry_id, body))


@attendance.get("/bunks", response_model=ApiResponse[list[BunkRow]])
async def bunks(db: DB, on: date = Query(alias="date"), section_id: uuid.UUID | None = None,
                current: CurrentUser = require_permission("attendance.view")):
    current.require_school()
    return ok(await svc.bunks(db, current.user, on, section_id))


# ---- biometric devices ------------------------------------------------------------------------

@devices.get("", response_model=ApiResponse[list[DeviceOut]])
async def list_devices(db: DB, current: CurrentUser = require_permission("devices.manage")):
    current.require_school()
    return ok(await biometric_service.list_devices(db, current.user))


@devices.post("", response_model=ApiResponse[DeviceOut], status_code=201)
async def add_device(body: DeviceIn, db: DB, current: CurrentUser = require_permission("devices.manage")):
    current.require_school()
    return ok(await biometric_service.add_device(db, current.user, body))


@devices.get("/punches", response_model=ApiResponse[list[PunchOut]])
async def punches(db: DB, current: CurrentUser = require_permission("devices.manage")):
    current.require_school()
    return ok(await biometric_service.recent_punches(db, current.user))


@devices.put("/ids", response_model=ApiResponse[dict])
async def set_ids(body: BiometricIds, db: DB, current: CurrentUser = require_permission("devices.manage")):
    current.require_school()
    return ok({"updated": await biometric_service.set_ids(db, current.user, body)})


@devices.put("/{device_id}", response_model=ApiResponse[DeviceOut])
async def edit_device(device_id: uuid.UUID, body: DeviceIn, db: DB, current: CurrentUser = require_permission("devices.manage")):
    current.require_school()
    return ok(await biometric_service.update_device(db, current.user, device_id, body))


@devices.delete("/{device_id}", response_model=ApiResponse[Message])
async def remove_device(device_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("devices.manage")):
    current.require_school()
    await biometric_service.delete_device(db, current.user, device_id)
    return ok(Message(message="Device removed"))


# ---- ADMS: called by the machines themselves (no user; identified by serial number) -------------

def _text(body: str | None) -> PlainTextResponse:
    return PlainTextResponse(body if body is not None else "UNKNOWN DEVICE", status_code=200 if body is not None else 403)


@iclock.get("/cdata", include_in_schema=False)
async def adms_handshake(db: DB, SN: str = Query(max_length=50)):  # noqa: N803 - the device's own parameter name
    return _text(await biometric_service.handshake(db, SN))


@iclock.post("/cdata", include_in_schema=False)
async def adms_upload(request: Request, db: DB, SN: str = Query(max_length=50), table: str = "ATTLOG"):  # noqa: N803
    body = (await request.body())[:1_000_000].decode("utf-8", errors="replace")
    return _text(await biometric_service.receive(db, SN, table, body))


@iclock.get("/getrequest", include_in_schema=False)
async def adms_poll(db: DB, SN: str = Query(max_length=50)):  # noqa: N803
    return _text(await biometric_service.poll(db, SN))


@iclock.post("/devicecmd", include_in_schema=False)
async def adms_command_result(db: DB, SN: str = Query(max_length=50)):  # noqa: N803
    return _text(await biometric_service.poll(db, SN))
