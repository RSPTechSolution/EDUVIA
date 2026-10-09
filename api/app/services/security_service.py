"""Gate and security: the visitor log, student gate passes, contract workers, the compliance vault, and CCTV with consent."""
import secrets
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import STAFF_ROLES, has_permission
from app.models import (
    Camera, CctvConsent, CctvView, ComplianceDoc, GatePass, School, SchoolClass, Section, StoredFile, Student, StudentGuardian, User, Visitor,
    Worker, WorkerLog,
)
from app.schemas.security import (
    ArriveIn, CameraIn, CameraOut, CctvSettings, ComplianceIn, ComplianceOut, ConsentCoverage, ConsentRow, GatePassIn, GatePassOut, GateSummary,
    InviteIn, ViewLogRow, VisitorIn, VisitorLookup, VisitorOut, WatchOut, WorkerIn, WorkerLogOut, WorkerOut,
)
from app.services import audit_service, notification_service, sms_service, storage_service
from app.services.academics_service import field_error
from app.services.attendance_extra_service import _approver_sections
from app.services.family_service import own_students, school_today

EXPIRING_DAYS = 30


def _now() -> datetime:
    return datetime.now(UTC)


async def _tz(db: AsyncSession, school_id: uuid.UUID) -> ZoneInfo:
    return ZoneInfo(await db.scalar(select(School.timezone).where(School.id == school_id)) or "Asia/Kolkata")


async def _day_bounds(db: AsyncSession, school_id: uuid.UUID, day: date) -> tuple[datetime, datetime]:
    tz = await _tz(db, school_id)
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


async def _names(db: AsyncSession, ids) -> dict[uuid.UUID, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return dict((await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))).all())


async def _labels(db: AsyncSession, student_ids) -> dict[uuid.UUID, str]:
    rows = (await db.execute(select(Student.id, SchoolClass.name, Section.name).join(SchoolClass, SchoolClass.id == Student.class_id)
                             .join(Section, Section.id == Student.section_id).where(Student.id.in_(list(student_ids))))).all()
    return {sid: f"{c} – {s}" for sid, c, s in rows}


# ---- visitors ---------------------------------------------------------------------------------

async def _visitors_out(db: AsyncSession, user: User, rows: list[Visitor]) -> list[VisitorOut]:
    names = await _names(db, [v.host_id for v in rows] + [v.logged_by for v in rows])
    gate = has_permission(user.role, "gate.manage")
    return [VisitorOut(id=v.id, name=v.name, phone=v.phone, purpose=v.purpose, meeting=v.meeting or names.get(v.host_id), host_id=v.host_id,
                       host_name=names.get(v.host_id), id_proof=v.id_proof, vehicle_no=v.vehicle_no, people=v.people, badge_no=v.badge_no, status=v.status,
                       expected_on=v.expected_on, in_at=v.in_at, out_at=v.out_at, photo_file_id=v.photo_file_id, logged_by=names.get(v.logged_by),
                       can_cancel=v.status == "expected" and (gate or v.host_id == user.id)) for v in rows]


async def _visitor(db: AsyncSession, user: User, vid: uuid.UUID) -> Visitor:
    v = await db.scalar(select(Visitor).where(Visitor.id == vid, Visitor.school_id == user.school_id))
    if not v:
        raise NotFound("Visitor not found")
    return v


async def list_visitors(db: AsyncSession, user: User, day: date | None, status: str | None, mine: bool = False) -> list[VisitorOut]:
    sid = user.school_id
    q = select(Visitor).where(Visitor.school_id == sid)
    if mine or not has_permission(user.role, "gate.view"):
        q = q.where(Visitor.host_id == user.id)  # a staff member's own guests
        if day:
            q = q.where(or_(Visitor.expected_on >= day, Visitor.status == "in"))
    elif day:
        start, end = await _day_bounds(db, sid, day)
        q = q.where(or_(Visitor.in_at.between(start, end), Visitor.expected_on == day, Visitor.status == "in"))
    if status:
        q = q.where(Visitor.status == status)
    rows = list((await db.scalars(q.order_by(Visitor.status != "in", Visitor.in_at.desc().nulls_last(), Visitor.created_at.desc()).limit(300))).all())
    return await _visitors_out(db, user, rows)


async def hosts(db: AsyncSession, user: User) -> list[dict]:
    rows = (await db.execute(select(User.id, User.full_name, User.designation).where(User.school_id == user.school_id, User.is_active.is_(True),
                                                                                  User.role.in_([r for r in STAFF_ROLES if r != "security_guard"]))
                             .order_by(User.full_name))).all()
    return [{"user_id": str(i), "full_name": n, "designation": d} for i, n, d in rows]


async def lookup(db: AsyncSession, user: User, phone: str) -> VisitorLookup | None:
    norm = "".join(ch for ch in phone if ch.isdigit())[-10:]
    if len(norm) < 7:
        return None
    rows = list((await db.scalars(select(Visitor).where(Visitor.school_id == user.school_id, Visitor.phone.isnot(None),
                                                        func.right(func.regexp_replace(Visitor.phone, r"\D", "", "g"), 10) == norm)
                                  .order_by(Visitor.created_at.desc()).limit(50))).all())
    if not rows:
        return None
    last = rows[0]
    return VisitorLookup(name=last.name, purpose=last.purpose, meeting=last.meeting, visits=len(rows), last_at=last.in_at)


async def _tell_host(db: AsyncSession, v: Visitor) -> None:
    if v.host_id:
        await notification_service.notify(db, [v.host_id], school_id=v.school_id, kind="visitor", title=f"{v.name} is at the gate",
                                          body=f"{v.purpose}" + (f" · {v.people} people" if v.people > 1 else ""), link="/gate?tab=visitors")


async def check_in(db: AsyncSession, user: User, data: VisitorIn) -> VisitorOut:
    if data.host_id and not await db.scalar(select(User.id).where(User.id == data.host_id, User.school_id == user.school_id, User.role.in_(STAFF_ROLES))):
        raise field_error("host_id", "Choose a staff member")
    v = Visitor(school_id=user.school_id, **data.model_dump(), status="in", in_at=_now(), logged_by=user.id)
    db.add(v)
    await db.flush()
    await _tell_host(db, v)
    return (await _visitors_out(db, user, [v]))[0]


async def invite(db: AsyncSession, user: User, data: InviteIn) -> VisitorOut:
    if data.expected_on < await school_today(db, user.school_id):
        raise field_error("expected_on", "Pick today or a later date")
    v = Visitor(school_id=user.school_id, name=data.name, phone=data.phone, purpose=data.purpose, people=data.people, expected_on=data.expected_on,
                host_id=user.id, meeting=user.full_name, status="expected", logged_by=user.id)
    db.add(v)
    await db.flush()
    return (await _visitors_out(db, user, [v]))[0]


async def arrive(db: AsyncSession, user: User, vid: uuid.UUID, data: ArriveIn) -> VisitorOut:
    v = await _visitor(db, user, vid)
    if v.status != "expected":
        raise AppError("This visitor isn't expected", code="NOT_EXPECTED", status_code=409)
    for k, val in data.model_dump(exclude_none=True).items():
        setattr(v, k, val)
    v.status, v.in_at, v.logged_by = "in", _now(), user.id
    await _tell_host(db, v)
    return (await _visitors_out(db, user, [v]))[0]


async def check_out(db: AsyncSession, user: User, vid: uuid.UUID) -> VisitorOut:
    v = await _visitor(db, user, vid)
    if v.status != "in":
        raise AppError("This visitor isn't on campus", code="NOT_INSIDE", status_code=409)
    v.status, v.out_at = "out", _now()
    return (await _visitors_out(db, user, [v]))[0]


async def cancel_visit(db: AsyncSession, user: User, vid: uuid.UUID) -> VisitorOut:
    v = await _visitor(db, user, vid)
    if v.status != "expected" or not (has_permission(user.role, "gate.manage") or v.host_id == user.id):
        raise Forbidden("You can't cancel this visit", code="PERMISSION_DENIED")
    v.status = "cancelled"
    return (await _visitors_out(db, user, [v]))[0]


# ---- gate passes ------------------------------------------------------------------------------

async def _passes_out(db: AsyncSession, user: User, rows: list[GatePass]) -> list[GatePassOut]:
    if not rows:
        return []
    students = {s.id: s for s in (await db.scalars(select(Student).where(Student.id.in_({p.student_id for p in rows})))).all()}
    labels = await _labels(db, students)
    names = await _names(db, [x for p in rows for x in (p.requested_by, p.decided_by, p.verified_by)])
    family = {k.id for k in await own_students(db, user)} if user.role in ("parent", "student") else set()
    approve = await _approver_sections(db, user)
    sees_code = has_permission(user.role, "gate.view") or has_permission(user.role, "gatepass.issue")
    out = []
    for p in rows:
        s = students[p.student_id]
        mine = p.student_id in family
        out.append(GatePassOut(
            id=p.id, student_id=p.student_id, student_name=f"{s.first_name} {s.last_name}", class_section=labels.get(s.id, ""), photo_file_id=s.photo_file_id,
            reason=p.reason, pickup_name=p.pickup_name, pickup_relation=p.pickup_relation, pickup_phone=p.pickup_phone, leave_at=p.leave_at, status=p.status,
            code=p.code if p.status == "approved" and (mine or sees_code) else None, requested_by=names.get(p.requested_by), decided_by=names.get(p.decided_by),
            decision_note=p.decision_note, used_at=p.used_at, verified_by=names.get(p.verified_by),
            can_decide=p.status == "pending" and (approve is None or s.section_id in approve),
            can_cancel=p.status in ("pending", "approved") and (mine or p.requested_by == user.id or has_permission(user.role, "gatepass.issue"))))
    return out


async def request_pass(db: AsyncSession, user: User, data: GatePassIn) -> GatePassOut:
    office = has_permission(user.role, "gatepass.issue")
    if office:
        s = await db.scalar(select(Student).where(Student.id == data.student_id, Student.school_id == user.school_id, Student.status == "active"))
    else:
        s = next((k for k in await own_students(db, user) if k.id == data.student_id), None) if user.role in ("parent", "student") else None
    if not s:
        raise NotFound("Student not found")
    now = _now()
    leave_at = data.leave_at if data.leave_at.tzinfo else data.leave_at.replace(tzinfo=await _tz(db, user.school_id))
    if leave_at < now - timedelta(minutes=30) or leave_at > now + timedelta(days=14):
        raise field_error("leave_at", "Pick a time from now up to two weeks ahead")
    p = GatePass(school_id=user.school_id, student_id=s.id, requested_by=user.id, reason=data.reason, pickup_name=data.pickup_name,
                 pickup_relation=data.pickup_relation, pickup_phone=data.pickup_phone, leave_at=leave_at, code=f"{secrets.randbelow(10**6):06d}",
                 status="approved" if office else "pending", decided_by=user.id if office else None, decided_at=now if office else None)
    db.add(p)
    await db.flush()
    local = leave_at.astimezone(await _tz(db, user.school_id))
    if office:
        await _tell_family_code(db, p, s, local)
    else:
        section = await db.get(Section, s.section_id)
        approvers = [section.class_teacher_id] if section and section.class_teacher_id else (await db.scalars(
            select(User.id).where(User.school_id == user.school_id, User.role.in_(["school_admin", "principal"]), User.is_active.is_(True)))).all()
        await notification_service.notify(db, approvers, school_id=user.school_id, kind="gate_pass", title=f"Early pickup: {s.first_name} {s.last_name}",
                                          body=f"{local:%d %b, %I:%M %p} by {p.pickup_name} ({p.pickup_relation}) · {p.reason[:100]}", link="/gate?tab=passes")
    return (await _passes_out(db, user, [p]))[0]


async def _tell_family_code(db: AsyncSession, p: GatePass, s: Student, local: datetime) -> None:
    to = await notification_service.family_of(db, [s.id])
    await notification_service.notify(db, to, school_id=p.school_id, kind="gate_pass", title=f"Gate pass approved for {s.first_name}",
                                      body=f"{p.pickup_name} shows code {p.code} at the gate on {local:%d %b} from {local:%I:%M %p}.", link="/gate-pass")


async def _pass(db: AsyncSession, user: User, pid: uuid.UUID) -> tuple[GatePass, Student]:
    p = await db.scalar(select(GatePass).where(GatePass.id == pid, GatePass.school_id == user.school_id))
    if not p:
        raise NotFound("Gate pass not found")
    return p, await db.get(Student, p.student_id)


async def decide_pass(db: AsyncSession, user: User, pid: uuid.UUID, approve: bool, note: str | None) -> GatePassOut:
    p, s = await _pass(db, user, pid)
    sections = await _approver_sections(db, user)
    if sections is not None and s.section_id not in sections:
        raise Forbidden("Only the class teacher or the office can decide this", code="PERMISSION_DENIED")
    if p.status != "pending":
        raise AppError("This gate pass has already been decided", code="ALREADY_DECIDED", status_code=409)
    p.status, p.decided_by, p.decided_at, p.decision_note = ("approved" if approve else "rejected"), user.id, _now(), note
    local = p.leave_at.astimezone(await _tz(db, user.school_id))
    if approve:
        await _tell_family_code(db, p, s, local)
    else:
        await notification_service.notify(db, await notification_service.family_of(db, [s.id]), school_id=user.school_id, kind="gate_pass",
                                          title=f"Gate pass declined for {s.first_name}", body=note or "Please call the school office.", link="/gate-pass")
    return (await _passes_out(db, user, [p]))[0]


async def cancel_pass(db: AsyncSession, user: User, pid: uuid.UUID) -> GatePassOut:
    p, _ = await _pass(db, user, pid)
    out = (await _passes_out(db, user, [p]))[0]
    if not out.can_cancel:
        raise Forbidden("You can't cancel this gate pass", code="PERMISSION_DENIED")
    p.status = "cancelled"
    return (await _passes_out(db, user, [p]))[0]


async def list_passes(db: AsyncSession, user: User, day: date | None, status: str | None) -> list[GatePassOut]:
    sid = user.school_id
    q = select(GatePass).where(GatePass.school_id == sid)
    if user.role in ("parent", "student"):
        q = q.where(GatePass.student_id.in_([k.id for k in await own_students(db, user)] or [uuid.uuid4()]))
    elif not (has_permission(user.role, "gate.view") or has_permission(user.role, "gatepass.issue")):
        sections = await _approver_sections(db, user)
        if sections is not None:
            q = q.join(Student, Student.id == GatePass.student_id).where(Student.section_id.in_(sections or [uuid.uuid4()]))
    if day:
        start, end = await _day_bounds(db, sid, day)
        q = q.where(GatePass.leave_at.between(start, end))
    if status:
        q = q.where(GatePass.status == status)
    rows = list((await db.scalars(q.order_by(GatePass.status != "pending", GatePass.leave_at.desc()).limit(200))).all())
    return await _passes_out(db, user, rows)


async def verify_code(db: AsyncSession, user: User, code: str) -> GatePassOut:
    start, end = await _day_bounds(db, user.school_id, await school_today(db, user.school_id))
    p = await db.scalar(select(GatePass).where(GatePass.school_id == user.school_id, GatePass.code == code.strip(),
                                               GatePass.leave_at.between(start, end), GatePass.status.in_(("approved", "used"))))
    if not p:
        raise AppError("No approved gate pass for today has this code", code="INVALID_CODE", status_code=404)
    return (await _passes_out(db, user, [p]))[0]


async def mark_left(db: AsyncSession, user: User, pid: uuid.UUID) -> GatePassOut:
    p, s = await _pass(db, user, pid)
    if p.status != "approved":
        raise AppError("Only an approved pass can be used" if p.status != "used" else "This student has already left", code="NOT_APPROVED", status_code=409)
    p.status, p.used_at, p.verified_by = "used", _now(), user.id
    local = p.used_at.astimezone(await _tz(db, user.school_id))
    msg = f"{s.first_name} left school at {local:%I:%M %p} with {p.pickup_name} ({p.pickup_relation})."
    await notification_service.notify(db, await notification_service.family_of(db, [s.id]), school_id=user.school_id, kind="gate_pass",
                                      title=f"{s.first_name} has left school", body=msg, link="/gate-pass")
    await sms_service.queue(db, school_id=user.school_id, event_name="gate", phones=await sms_service.family_phones(db, [s.id]), body=msg)
    return (await _passes_out(db, user, [p]))[0]


# ---- workers ----------------------------------------------------------------------------------

def _blocked(w: Worker, today: date) -> str | None:
    if not w.is_active:
        return "Not active"
    if w.valid_until and w.valid_until < today:
        return f"Pass ended on {w.valid_until:%d %b %Y}"
    if not w.police_verified:
        return "Police verification pending"
    return None


async def _workers_out(db: AsyncSession, school_id: uuid.UUID, rows: list[Worker]) -> list[WorkerOut]:
    today = await school_today(db, school_id)
    inside = dict((await db.execute(select(WorkerLog.worker_id, WorkerLog.in_at).where(WorkerLog.worker_id.in_([w.id for w in rows]),
                                                                                    WorkerLog.out_at.is_(None)))).all())
    out = []
    for w in rows:
        why = _blocked(w, today)
        out.append(WorkerOut(id=w.id, name=w.name, phone=w.phone, trade=w.trade, agency=w.agency, id_proof=w.id_proof, police_verified=w.police_verified,
                             verified_on=w.verified_on, valid_until=w.valid_until, is_active=w.is_active, notes=w.notes, photo_file_id=w.photo_file_id,
                             on_campus_since=inside.get(w.id), can_enter=why is None, blocked_reason=why))
    return out


async def _worker(db: AsyncSession, user: User, wid: uuid.UUID) -> Worker:
    w = await db.scalar(select(Worker).where(Worker.id == wid, Worker.school_id == user.school_id))
    if not w:
        raise NotFound("Worker not found")
    return w


async def list_workers(db: AsyncSession, user: User, q: str | None) -> list[WorkerOut]:
    stmt = select(Worker).where(Worker.school_id == user.school_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Worker.name.ilike(like), Worker.trade.ilike(like), Worker.agency.ilike(like), Worker.phone.ilike(like)))
    rows = list((await db.scalars(stmt.order_by(Worker.is_active.desc(), Worker.name).limit(500))).all())
    return await _workers_out(db, user.school_id, rows)


async def save_worker(db: AsyncSession, user: User, data: WorkerIn, wid: uuid.UUID | None = None) -> WorkerOut:
    if data.police_verified and not data.verified_on:
        raise field_error("verified_on", "Enter the date of the police verification")
    if wid:
        w = await _worker(db, user, wid)
        for k, v in data.model_dump().items():
            setattr(w, k, v)
    else:
        w = Worker(school_id=user.school_id, **data.model_dump())
        db.add(w)
    await db.flush()
    await audit_service.record(db, "worker.save", school_id=user.school_id, user_id=user.id, entity_type="worker", entity_id=w.id,
                               meta={"name": w.name, "police_verified": w.police_verified, "active": w.is_active})
    return (await _workers_out(db, user.school_id, [w]))[0]


async def worker_in(db: AsyncSession, user: User, wid: uuid.UUID) -> WorkerOut:
    w = await _worker(db, user, wid)
    why = _blocked(w, await school_today(db, user.school_id))
    if why:
        raise AppError(f"{w.name} can't come in: {why.lower()}", code="ENTRY_BLOCKED", status_code=409)
    if await db.scalar(select(WorkerLog.id).where(WorkerLog.worker_id == w.id, WorkerLog.out_at.is_(None))):
        raise AppError(f"{w.name} is already on campus", code="ALREADY_INSIDE", status_code=409)
    db.add(WorkerLog(school_id=user.school_id, worker_id=w.id, in_at=_now(), by=user.id))
    await db.flush()
    return (await _workers_out(db, user.school_id, [w]))[0]


async def worker_out(db: AsyncSession, user: User, wid: uuid.UUID) -> WorkerOut:
    w = await _worker(db, user, wid)
    log = await db.scalar(select(WorkerLog).where(WorkerLog.worker_id == w.id, WorkerLog.out_at.is_(None)))
    if not log:
        raise AppError(f"{w.name} isn't on campus", code="NOT_INSIDE", status_code=409)
    log.out_at = _now()
    await db.flush()
    return (await _workers_out(db, user.school_id, [w]))[0]


async def worker_logs(db: AsyncSession, user: User, day: date) -> list[WorkerLogOut]:
    start, end = await _day_bounds(db, user.school_id, day)
    rows = (await db.execute(select(WorkerLog, Worker).join(Worker, Worker.id == WorkerLog.worker_id)
                             .where(WorkerLog.school_id == user.school_id, or_(WorkerLog.in_at.between(start, end), WorkerLog.out_at.is_(None)))
                             .order_by(WorkerLog.in_at.desc()))).all()
    return [WorkerLogOut(id=log.id, worker_id=w.id, name=w.name, trade=w.trade, in_at=log.in_at, out_at=log.out_at) for log, w in rows]


# ---- compliance -------------------------------------------------------------------------------

def _state(d: ComplianceDoc, today: date) -> tuple[str, int | None]:
    if not d.expires_on:
        return "no_expiry", None
    left = (d.expires_on - today).days
    return ("expired" if left < 0 else "expiring" if left <= EXPIRING_DAYS else "valid"), left


async def _docs_out(db: AsyncSession, school_id: uuid.UUID, rows: list[ComplianceDoc]) -> list[ComplianceOut]:
    today = await school_today(db, school_id)
    files = dict((await db.execute(select(StoredFile.owner_id, func.count()).where(StoredFile.purpose == "compliance_doc",
                                                                                   StoredFile.owner_id.in_([d.id for d in rows]))
                                   .group_by(StoredFile.owner_id))).all())
    out = []
    for d in rows:
        state, left = _state(d, today)
        out.append(ComplianceOut(id=d.id, title=d.title, category=d.category, reference_no=d.reference_no, authority=d.authority, issued_on=d.issued_on,
                                 expires_on=d.expires_on, notes=d.notes, state=state, days_left=left, files=files.get(d.id, 0)))
    return out


async def list_docs(db: AsyncSession, user: User) -> list[ComplianceOut]:
    rows = list((await db.scalars(select(ComplianceDoc).where(ComplianceDoc.school_id == user.school_id)
                                  .order_by(ComplianceDoc.expires_on.asc().nulls_last(), ComplianceDoc.title))).all())
    return await _docs_out(db, user.school_id, rows)


async def save_doc(db: AsyncSession, user: User, data: ComplianceIn, did: uuid.UUID | None = None) -> ComplianceOut:
    if data.issued_on and data.expires_on and data.expires_on < data.issued_on:
        raise field_error("expires_on", "Expiry must be after the issue date")
    if did:
        d = await db.scalar(select(ComplianceDoc).where(ComplianceDoc.id == did, ComplianceDoc.school_id == user.school_id))
        if not d:
            raise NotFound("Document not found")
        if d.expires_on != data.expires_on:
            d.reminded_on = None  # renewed: remind again before the new date
        for k, v in data.model_dump().items():
            setattr(d, k, v)
    else:
        d = ComplianceDoc(school_id=user.school_id, **data.model_dump())
        db.add(d)
    await db.flush()
    await audit_service.record(db, "compliance.save", school_id=user.school_id, user_id=user.id, entity_type="compliance_doc", entity_id=d.id,
                               meta={"title": d.title, "expires_on": d.expires_on.isoformat() if d.expires_on else None})
    return (await _docs_out(db, user.school_id, [d]))[0]


async def delete_doc(db: AsyncSession, user: User, did: uuid.UUID) -> None:
    d = await db.scalar(select(ComplianceDoc).where(ComplianceDoc.id == did, ComplianceDoc.school_id == user.school_id))
    if not d:
        raise NotFound("Document not found")
    for f in (await db.scalars(select(StoredFile).where(StoredFile.purpose == "compliance_doc", StoredFile.owner_id == d.id))).all():
        await storage_service.delete_file(db, f)
    await db.delete(d)
    await audit_service.record(db, "compliance.delete", school_id=user.school_id, user_id=user.id, entity_type="compliance_doc", entity_id=did,
                               meta={"title": d.title})


async def remind_docs(db: AsyncSession, school_id: uuid.UUID) -> int:
    """Tell the admins about documents expiring within 30 days or already expired, once per document per renewal."""
    today = await school_today(db, school_id)
    rows = list((await db.scalars(select(ComplianceDoc).where(ComplianceDoc.school_id == school_id, ComplianceDoc.expires_on.isnot(None),
                                                              ComplianceDoc.expires_on <= today + timedelta(days=EXPIRING_DAYS),
                                                              ComplianceDoc.reminded_on.is_(None)))).all())
    if not rows:
        return 0
    admins = (await db.scalars(select(User.id).where(User.school_id == school_id, User.is_active.is_(True), User.role.in_(["school_admin", "principal"])))).all()
    for d in rows:
        left = (d.expires_on - today).days
        await notification_service.notify(db, admins, school_id=school_id, kind="compliance", title=f"{d.title} {'expired' if left < 0 else 'expires soon'}",
                                          body=f"{'Expired' if left < 0 else 'Expires'} on {d.expires_on:%d %b %Y}" + (f" · {left} days left" if left >= 0 else ""),
                                          link="/compliance")
        d.reminded_on = today
    return len(rows)


async def summary(db: AsyncSession, user: User) -> GateSummary:
    sid = user.school_id
    today = await school_today(db, sid)
    start, end = await _day_bounds(db, sid, today)
    count = lambda q: db.scalar(select(func.count()).select_from(q.subquery()))  # noqa: E731
    return GateSummary(
        visitors_inside=await count(select(Visitor.id).where(Visitor.school_id == sid, Visitor.status == "in")) or 0,
        visitors_today=await count(select(Visitor.id).where(Visitor.school_id == sid, Visitor.in_at.between(start, end))) or 0,
        expected_today=await count(select(Visitor.id).where(Visitor.school_id == sid, Visitor.status == "expected", Visitor.expected_on == today)) or 0,
        workers_inside=await count(select(WorkerLog.id).where(WorkerLog.school_id == sid, WorkerLog.out_at.is_(None))) or 0,
        passes_pending=await count(select(GatePass.id).where(GatePass.school_id == sid, GatePass.status == "pending")) or 0,
        passes_today=await count(select(GatePass.id).where(GatePass.school_id == sid, GatePass.status.in_(("approved", "used")),
                                                           GatePass.leave_at.between(start, end))) or 0,
        compliance_due=await count(select(ComplianceDoc.id).where(ComplianceDoc.school_id == sid, ComplianceDoc.expires_on.isnot(None),
                                                                  ComplianceDoc.expires_on <= today + timedelta(days=EXPIRING_DAYS))) or 0,
    )


# ---- CCTV -------------------------------------------------------------------------------------

async def cctv_settings(db: AsyncSession, school_id: uuid.UUID) -> CctvSettings:
    school = await db.get(School, school_id)
    return CctvSettings(**((school.settings or {}).get("cctv") or {}))


async def save_cctv_settings(db: AsyncSession, user: User, data: CctvSettings) -> CctvSettings:
    school = await db.get(School, user.school_id)
    school.settings = {**(school.settings or {}), "cctv": data.model_dump()}
    await audit_service.record(db, "cctv.settings", school_id=user.school_id, user_id=user.id, entity_type="school", entity_id=school.id,
                               meta={"parent_viewing": data.parent_viewing})
    return data


async def coverage(db: AsyncSession, school_id: uuid.UUID, section_ids=None) -> dict[uuid.UUID, ConsentCoverage]:
    """Per section: students, and how many have a yes (and no 'no') from their guardians, a 'no', or no answer yet."""
    q = (select(Section.id, SchoolClass.name, Section.name, SchoolClass.sort_order).join(SchoolClass, SchoolClass.id == Section.class_id)
         .where(Section.school_id == school_id))
    if section_ids is not None:
        q = q.where(Section.id.in_(list(section_ids) or [uuid.uuid4()]))
    sections = (await db.execute(q.order_by(SchoolClass.sort_order, Section.name))).all()
    students = (await db.execute(select(Student.id, Student.section_id).where(Student.school_id == school_id, Student.status == "active",
                                                                              Student.section_id.in_([s[0] for s in sections])))).all()
    answers: dict[uuid.UUID, list[bool]] = {}
    for sid, ok in (await db.execute(select(CctvConsent.student_id, CctvConsent.consent).where(CctvConsent.school_id == school_id))).all():
        answers.setdefault(sid, []).append(ok)
    out = {sec: ConsentCoverage(section_id=sec, label=f"{c} – {s}", students=0, yes=0, no=0, unanswered=0) for sec, c, s, _ in sections}
    for stid, sec in students:
        row = out[sec]
        row.students += 1
        a = answers.get(stid)
        if not a:
            row.unanswered += 1
        elif all(a):
            row.yes += 1
        else:
            row.no += 1
    return out


def _complete(c: ConsentCoverage | None) -> bool:
    return bool(c and c.students and c.yes == c.students)


async def _section_labels(db: AsyncSession, ids) -> dict[uuid.UUID, str]:
    rows = (await db.execute(select(Section.id, SchoolClass.name, Section.name).join(SchoolClass, SchoolClass.id == Section.class_id)
                             .where(Section.id.in_({i for i in ids if i})))).all()
    return {i: f"{c} – {s}" for i, c, s in rows}


async def list_cameras(db: AsyncSession, user: User) -> list[CameraOut]:
    sid = user.school_id
    manager = has_permission(user.role, "cctv.manage")
    q = select(Camera).where(Camera.school_id == sid)
    kids: list[Student] = []
    if not manager:
        if user.role not in ("parent", "student"):
            raise Forbidden("Not allowed", code="PERMISSION_DENIED")
        kids = await own_students(db, user)
        q = q.where(Camera.is_active.is_(True), Camera.parent_viewable.is_(True), Camera.section_id.in_([k.section_id for k in kids] or [uuid.uuid4()]))
    rows = list((await db.scalars(q.order_by(Camera.name))).all())
    labels = await _section_labels(db, [c.section_id for c in rows])
    cov = await coverage(db, sid, {c.section_id for c in rows if c.section_id})
    settings = await cctv_settings(db, sid)
    mine = {}
    if kids:
        mine = {s: ok for s, ok in (await db.execute(select(CctvConsent.student_id, CctvConsent.consent).where(
            CctvConsent.guardian_id == user.id, CctvConsent.student_id.in_([k.id for k in kids])))).all()}
    out = []
    for c in rows:
        cv = cov.get(c.section_id)
        reason = None
        if not manager:
            kid_ids = [k.id for k in kids if k.section_id == c.section_id]
            if not settings.parent_viewing:
                reason = "The school hasn't turned on parent viewing"
            elif not any(mine.get(k) for k in kid_ids):
                reason = "Give your consent first"
            elif not _complete(cv):
                reason = "Every family in the class must agree first"
        elif not c.stream_url:
            reason = "No stream link set"
        out.append(CameraOut(id=c.id, name=c.name, location=c.location, section_id=c.section_id, section_label=labels.get(c.section_id),
                             stream_url=c.stream_url if manager else None, parent_viewable=c.parent_viewable, is_active=c.is_active,
                             consent=cv.model_dump(include={"students", "yes", "no", "unanswered"}) | {"complete": _complete(cv)} if cv else None,
                             watchable=reason is None and bool(c.stream_url) and c.is_active, blocked_reason=reason))
    return out


async def save_camera(db: AsyncSession, user: User, data: CameraIn, cid: uuid.UUID | None = None) -> CameraOut:
    if data.section_id and not await db.scalar(select(Section.id).where(Section.id == data.section_id, Section.school_id == user.school_id)):
        raise field_error("section_id", "Choose a class section")
    if data.parent_viewable and not data.section_id:
        raise field_error("section_id", "Only a classroom camera can be shown to parents")
    if cid:
        c = await db.scalar(select(Camera).where(Camera.id == cid, Camera.school_id == user.school_id))
        if not c:
            raise NotFound("Camera not found")
        for k, v in data.model_dump().items():
            setattr(c, k, v)
    else:
        c = Camera(school_id=user.school_id, **data.model_dump())
        db.add(c)
    await db.flush()
    await audit_service.record(db, "cctv.camera", school_id=user.school_id, user_id=user.id, entity_type="camera", entity_id=c.id,
                               meta={"name": c.name, "parent_viewable": c.parent_viewable})
    return next(x for x in await list_cameras(db, user) if x.id == c.id)


async def watch(db: AsyncSession, user: User, cid: uuid.UUID) -> WatchOut:
    cam = next((c for c in await list_cameras(db, user) if c.id == cid), None)
    if not cam:
        raise NotFound("Camera not found")
    if not cam.watchable:
        raise AppError(cam.blocked_reason or "This camera can't be watched now", code="NOT_WATCHABLE", status_code=409)
    c = await db.get(Camera, cid)
    db.add(CctvView(school_id=user.school_id, camera_id=c.id, user_id=user.id))
    await db.flush()
    return WatchOut(camera_id=c.id, name=c.name, stream_url=c.stream_url)


async def my_consents(db: AsyncSession, user: User) -> list[ConsentRow]:
    kids = await own_students(db, user)
    labels = await _labels(db, [k.id for k in kids])
    rows = {c.student_id: c for c in (await db.scalars(select(CctvConsent).where(CctvConsent.guardian_id == user.id,
                                                                                CctvConsent.student_id.in_([k.id for k in kids] or [uuid.uuid4()])))).all()}
    return [ConsentRow(student_id=k.id, name=f"{k.first_name} {k.last_name}", class_section=labels.get(k.id, ""),
                       consent=rows[k.id].consent if k.id in rows else None, decided_at=rows[k.id].decided_at if k.id in rows else None) for k in kids]


async def set_consent(db: AsyncSession, user: User, student_id: uuid.UUID, consent: bool) -> list[ConsentRow]:
    if user.role != "parent":
        raise Forbidden("Only a parent or guardian can answer", code="PERMISSION_DENIED")
    if not await db.scalar(select(StudentGuardian.student_id).where(StudentGuardian.student_id == student_id, StudentGuardian.user_id == user.id)):
        raise NotFound("Student not found")
    row = await db.scalar(select(CctvConsent).where(CctvConsent.student_id == student_id, CctvConsent.guardian_id == user.id))
    if row:
        row.consent, row.decided_at = consent, _now()
    else:
        db.add(CctvConsent(school_id=user.school_id, student_id=student_id, guardian_id=user.id, consent=consent, decided_at=_now()))
    await db.flush()
    await audit_service.record(db, "cctv.consent", school_id=user.school_id, user_id=user.id, entity_type="student", entity_id=student_id,
                               meta={"consent": consent})
    return await my_consents(db, user)


async def view_log(db: AsyncSession, user: User) -> list[ViewLogRow]:
    rows = (await db.execute(select(CctvView.at, Camera.name, User.full_name, User.role).join(Camera, Camera.id == CctvView.camera_id)
                             .outerjoin(User, User.id == CctvView.user_id).where(CctvView.school_id == user.school_id)
                             .order_by(CctvView.at.desc()).limit(200))).all()
    return [ViewLogRow(camera=c, user=n, role=r, at=at) for at, c, n, r in rows]


# ---- files ------------------------------------------------------------------------------------

def _photo_purpose(model, perm_upload: str, perm_read: str):
    async def can_upload(db: AsyncSession, user: User, owner_id: uuid.UUID | None) -> bool:
        return bool(owner_id) and has_permission(user.role, perm_upload) and bool(
            await db.scalar(select(model.id).where(model.id == owner_id, model.school_id == user.school_id)))

    async def can_read(db: AsyncSession, user: User, owner_id: uuid.UUID | None) -> bool:
        return has_permission(user.role, perm_read)

    async def on_change(db: AsyncSession, user: User, owner_id: uuid.UUID | None, file_id: uuid.UUID | None) -> None:
        row = await db.get(model, owner_id)
        if row:
            row.photo_file_id = file_id

    return storage_service.Purpose(can_upload=can_upload, can_read=can_read, images_only=True, single=True, on_change=on_change)


async def _doc_upload(db: AsyncSession, user: User, owner_id: uuid.UUID | None) -> bool:
    return bool(owner_id) and has_permission(user.role, "compliance.manage") and bool(
        await db.scalar(select(ComplianceDoc.id).where(ComplianceDoc.id == owner_id, ComplianceDoc.school_id == user.school_id)))


async def _doc_read(db: AsyncSession, user: User, owner_id: uuid.UUID | None) -> bool:
    return has_permission(user.role, "compliance.view")


storage_service.register_purpose("visitor_photo", _photo_purpose(Visitor, "gate.manage", "gate.view"))
storage_service.register_purpose("worker_photo", _photo_purpose(Worker, "gate.manage", "gate.view"))
storage_service.register_purpose("compliance_doc", storage_service.Purpose(can_upload=_doc_upload, can_read=_doc_read))
