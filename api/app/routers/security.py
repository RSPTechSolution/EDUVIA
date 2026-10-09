"""Gate and security (/gate, /compliance) and CCTV (/cctv)."""
import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.core.deps import DB, Auth, CurrentUser, require_module, require_permission
from app.core.errors import Forbidden
from app.core.permissions import STAFF_ROLES, has_permission
from app.schemas.common import ApiResponse, Message, ok
from app.schemas.security import (
    ArriveIn, CameraIn, CameraOut, CctvSettings, ComplianceIn, ComplianceOut, ConsentCoverage, ConsentIn, ConsentRow, GatePassDecision, GatePassIn,
    GatePassOut, GateSummary, InviteIn, ViewLogRow, VisitorIn, VisitorLookup, VisitorOut, WatchOut, WorkerIn, WorkerLogOut, WorkerOut,
)
from app.services import security_service as svc

gate = APIRouter(dependencies=[require_module("security")])
compliance = APIRouter(dependencies=[require_module("security")])
cctv = APIRouter(dependencies=[require_module("cctv")])


@gate.get("/summary", response_model=ApiResponse[GateSummary])
async def summary(db: DB, current: CurrentUser = require_permission("gate.view")):
    current.require_school()
    return ok(await svc.summary(db, current.user))


# ---- visitors ---------------------------------------------------------------------------------

@gate.get("/visitors", response_model=ApiResponse[list[VisitorOut]])
async def visitors(db: DB, current: Auth, day: date | None = Query(None, alias="date"), status: str | None = None, mine: bool = False):
    current.require_school()
    if current.role not in STAFF_ROLES:
        raise Forbidden("For school staff only", code="PERMISSION_DENIED")
    return ok(await svc.list_visitors(db, current.user, day, status, mine))


@gate.get("/hosts", response_model=ApiResponse[list[dict]])
async def hosts(db: DB, current: CurrentUser = require_permission("gate.manage")):
    """Staff a visitor can be sent to."""
    current.require_school()
    return ok(await svc.hosts(db, current.user))


@gate.get("/visitors/lookup", response_model=ApiResponse[VisitorLookup | None])
async def lookup(db: DB, phone: str = Query(min_length=7, max_length=20), current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.lookup(db, current.user, phone))


@gate.post("/visitors", response_model=ApiResponse[VisitorOut], status_code=201)
async def check_in(body: VisitorIn, db: DB, current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.check_in(db, current.user, body))


@gate.post("/visitors/invite", response_model=ApiResponse[VisitorOut], status_code=201)
async def invite(body: InviteIn, db: DB, current: CurrentUser = require_permission("visitors.invite")):
    current.require_school()
    return ok(await svc.invite(db, current.user, body))


@gate.post("/visitors/{vid}/arrive", response_model=ApiResponse[VisitorOut])
async def arrive(vid: uuid.UUID, body: ArriveIn, db: DB, current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.arrive(db, current.user, vid, body))


@gate.post("/visitors/{vid}/out", response_model=ApiResponse[VisitorOut])
async def check_out(vid: uuid.UUID, db: DB, current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.check_out(db, current.user, vid))


@gate.post("/visitors/{vid}/cancel", response_model=ApiResponse[VisitorOut])
async def cancel_visit(vid: uuid.UUID, db: DB, current: CurrentUser = require_permission("visitors.invite")):
    current.require_school()
    return ok(await svc.cancel_visit(db, current.user, vid))


# ---- gate passes ------------------------------------------------------------------------------

@gate.get("/passes", response_model=ApiResponse[list[GatePassOut]])
async def passes(db: DB, current: Auth, day: date | None = Query(None, alias="date"), status: str | None = None):
    current.require_school()
    return ok(await svc.list_passes(db, current.user, day, status))


@gate.post("/passes", response_model=ApiResponse[GatePassOut], status_code=201)
async def request_pass(body: GatePassIn, db: DB, current: Auth):
    current.require_school()
    return ok(await svc.request_pass(db, current.user, body))


@gate.get("/passes/verify", response_model=ApiResponse[GatePassOut])
async def verify(db: DB, code: str = Query(pattern=r"^\s*\d{6}\s*$"), current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.verify_code(db, current.user, code))


@gate.post("/passes/{pid}/decide", response_model=ApiResponse[GatePassOut])
async def decide(pid: uuid.UUID, body: GatePassDecision, db: DB, current: Auth):
    current.require_school()
    if not (has_permission(current.role, "leave.approve") or has_permission(current.role, "attendance.manage")):
        raise Forbidden("Not allowed", code="PERMISSION_DENIED")
    return ok(await svc.decide_pass(db, current.user, pid, body.approve, body.note))


@gate.post("/passes/{pid}/cancel", response_model=ApiResponse[GatePassOut])
async def cancel_pass(pid: uuid.UUID, db: DB, current: Auth):
    current.require_school()
    return ok(await svc.cancel_pass(db, current.user, pid))


@gate.post("/passes/{pid}/left", response_model=ApiResponse[GatePassOut])
async def left(pid: uuid.UUID, db: DB, current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.mark_left(db, current.user, pid))


# ---- workers ----------------------------------------------------------------------------------

@gate.get("/workers", response_model=ApiResponse[list[WorkerOut]])
async def workers(db: DB, q: str | None = Query(None, max_length=100), current: CurrentUser = require_permission("gate.view")):
    current.require_school()
    return ok(await svc.list_workers(db, current.user, q))


@gate.post("/workers", response_model=ApiResponse[WorkerOut], status_code=201)
async def add_worker(body: WorkerIn, db: DB, current: CurrentUser = require_permission("workers.manage")):
    current.require_school()
    return ok(await svc.save_worker(db, current.user, body))


@gate.put("/workers/{wid}", response_model=ApiResponse[WorkerOut])
async def edit_worker(wid: uuid.UUID, body: WorkerIn, db: DB, current: CurrentUser = require_permission("workers.manage")):
    current.require_school()
    return ok(await svc.save_worker(db, current.user, body, wid))


@gate.post("/workers/{wid}/in", response_model=ApiResponse[WorkerOut])
async def worker_in(wid: uuid.UUID, db: DB, current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.worker_in(db, current.user, wid))


@gate.post("/workers/{wid}/out", response_model=ApiResponse[WorkerOut])
async def worker_out(wid: uuid.UUID, db: DB, current: CurrentUser = require_permission("gate.manage")):
    current.require_school()
    return ok(await svc.worker_out(db, current.user, wid))


@gate.get("/worker-logs", response_model=ApiResponse[list[WorkerLogOut]])
async def worker_logs(db: DB, day: date = Query(alias="date"), current: CurrentUser = require_permission("gate.view")):
    current.require_school()
    return ok(await svc.worker_logs(db, current.user, day))


# ---- compliance vault -------------------------------------------------------------------------

@compliance.get("", response_model=ApiResponse[list[ComplianceOut]])
async def docs(db: DB, current: CurrentUser = require_permission("compliance.view")):
    current.require_school()
    return ok(await svc.list_docs(db, current.user))


@compliance.post("", response_model=ApiResponse[ComplianceOut], status_code=201)
async def add_doc(body: ComplianceIn, db: DB, current: CurrentUser = require_permission("compliance.manage")):
    current.require_school()
    return ok(await svc.save_doc(db, current.user, body))


@compliance.put("/{did}", response_model=ApiResponse[ComplianceOut])
async def edit_doc(did: uuid.UUID, body: ComplianceIn, db: DB, current: CurrentUser = require_permission("compliance.manage")):
    current.require_school()
    return ok(await svc.save_doc(db, current.user, body, did))


@compliance.delete("/{did}", response_model=ApiResponse[Message])
async def delete_doc(did: uuid.UUID, db: DB, current: CurrentUser = require_permission("compliance.manage")):
    current.require_school()
    await svc.delete_doc(db, current.user, did)
    return ok(Message(message="Document removed"))


@compliance.post("/remind", response_model=ApiResponse[Message])
async def remind(db: DB, current: CurrentUser = require_permission("compliance.manage")):
    current.require_school()
    n = await svc.remind_docs(db, current.user.school_id)
    return ok(Message(message=f"Sent {n} reminder(s)" if n else "Nothing new is due"))


# ---- CCTV -------------------------------------------------------------------------------------

@cctv.get("/settings", response_model=ApiResponse[CctvSettings])
async def cctv_settings(db: DB, current: Auth):
    current.require_school()
    return ok(await svc.cctv_settings(db, current.user.school_id))


@cctv.put("/settings", response_model=ApiResponse[CctvSettings])
async def save_cctv_settings(body: CctvSettings, db: DB, current: CurrentUser = require_permission("cctv.manage")):
    current.require_school()
    return ok(await svc.save_cctv_settings(db, current.user, body))


@cctv.get("/cameras", response_model=ApiResponse[list[CameraOut]])
async def cameras(db: DB, current: Auth):
    current.require_school()
    return ok(await svc.list_cameras(db, current.user))


@cctv.post("/cameras", response_model=ApiResponse[CameraOut], status_code=201)
async def add_camera(body: CameraIn, db: DB, current: CurrentUser = require_permission("cctv.manage")):
    current.require_school()
    return ok(await svc.save_camera(db, current.user, body))


@cctv.put("/cameras/{cid}", response_model=ApiResponse[CameraOut])
async def edit_camera(cid: uuid.UUID, body: CameraIn, db: DB, current: CurrentUser = require_permission("cctv.manage")):
    current.require_school()
    return ok(await svc.save_camera(db, current.user, body, cid))


@cctv.post("/cameras/{cid}/watch", response_model=ApiResponse[WatchOut])
async def watch(cid: uuid.UUID, db: DB, current: Auth):
    current.require_school()
    return ok(await svc.watch(db, current.user, cid))


@cctv.get("/consent", response_model=ApiResponse[list[ConsentRow]])
async def my_consent(db: DB, current: Auth):
    current.require_school()
    return ok(await svc.my_consents(db, current.user))


@cctv.put("/consent", response_model=ApiResponse[list[ConsentRow]])
async def set_consent(body: ConsentIn, db: DB, current: Auth):
    current.require_school()
    return ok(await svc.set_consent(db, current.user, body.student_id, body.consent))


@cctv.get("/coverage", response_model=ApiResponse[list[ConsentCoverage]])
async def consent_coverage(db: DB, current: CurrentUser = require_permission("cctv.manage")):
    current.require_school()
    return ok(list((await svc.coverage(db, current.user.school_id)).values()))


@cctv.get("/views", response_model=ApiResponse[list[ViewLogRow]])
async def views(db: DB, current: CurrentUser = require_permission("cctv.manage")):
    current.require_school()
    return ok(await svc.view_log(db, current.user))
