"""HR and payroll for school staff.

Pay is monthly. A payroll run takes each staff member's salary, works out loss-of-pay days from staff attendance
(absences not covered by paid leave, half a day for half days), prorates earnings, and deducts PF (12% of basic, on
at most Rs 15,000), ESI (0.75% while gross is at most Rs 21,000), professional tax and TDS.
"""
import calendar
import csv
import io
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import STAFF_ROLES, has_permission
from app.models import BiometricPunch, LeaveType, PayrollRun, Payslip, School, StaffAttendance, StaffLeave, StaffProfile, User
from app.schemas.hr import (
    DayMark, LeaveTypeIn, LeaveTypeOut, PayslipOut, ProfileIn, RunOut, StaffDayRow, StaffDetail, StaffLeaveIn, StaffLeaveOut, StaffRow,
)
from app.services import audit_service, notification_service
from app.services.academics_service import field_error
from app.services.attendance_extra_service import closed_days
from app.services.family_service import school_today

ZERO = Decimal(0)
DEFAULT_LEAVE = [("Casual leave", "CL", 12, True), ("Sick leave", "SL", 10, True), ("Earned leave", "EL", 15, True), ("Leave without pay", "LWP", 0, False)]
EARNINGS = ("basic", "hra", "da", "conveyance", "special")


def _r(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), ROUND_HALF_UP)


def _gross(p: StaffProfile | None) -> Decimal:
    return sum((getattr(p, k) or ZERO for k in EARNINGS), ZERO) if p else ZERO


async def _staff(db: AsyncSession, school_id: uuid.UUID, active_only: bool = True) -> list[User]:
    q = select(User).where(User.school_id == school_id, User.role.in_(STAFF_ROLES + ["driver"]), User.deleted_at.is_(None))
    if active_only:
        q = q.where(User.is_active.is_(True))
    return list((await db.scalars(q.order_by(User.full_name))).all())


async def _profiles(db: AsyncSession, ids) -> dict[uuid.UUID, StaffProfile]:
    return {p.user_id: p for p in (await db.scalars(select(StaffProfile).where(StaffProfile.user_id.in_(list(ids))))).all()}


# ---- staff directory --------------------------------------------------------------------------

async def directory(db: AsyncSession, user: User) -> list[StaffRow]:
    staff = await _staff(db, user.school_id)
    profiles = await _profiles(db, [u.id for u in staff])
    today = await school_today(db, user.school_id)
    marks = dict((await db.execute(select(StaffAttendance.user_id, StaffAttendance.status).where(
        StaffAttendance.school_id == user.school_id, StaffAttendance.date == today))).all())
    return [StaffRow(user_id=u.id, full_name=u.full_name, email=u.email, phone=u.phone, role=u.role, employee_id=u.employee_id,
                     designation=u.designation, department=profiles[u.id].department if u.id in profiles else None,
                     date_of_joining=profiles[u.id].date_of_joining if u.id in profiles else None, gross_monthly=_gross(profiles.get(u.id)),
                     has_bank=bool(u.id in profiles and profiles[u.id].bank_account and profiles[u.id].ifsc), today=marks.get(u.id)) for u in staff]


async def _member(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> User:
    u = await db.scalar(select(User).where(User.id == user_id, User.school_id == school_id, User.role.in_(STAFF_ROLES + ["driver"])))
    if not u:
        raise NotFound("Staff member not found")
    return u


async def detail(db: AsyncSession, user: User, user_id: uuid.UUID) -> StaffDetail:
    if user_id != user.id and not has_permission(user.role, "hr.view"):
        raise Forbidden("Not allowed", code="PERMISSION_DENIED")
    u = await _member(db, user.school_id, user_id)
    p = (await _profiles(db, [u.id])).get(u.id)
    row = next(r for r in await directory(db, user) if r.user_id == u.id) if u.is_active else None
    prof = {k: (getattr(p, k) if p else None) for k in ProfileIn.model_fields}
    prof = {k: (float(v) if isinstance(v, Decimal) else v.isoformat() if isinstance(v, date) else v) for k, v in prof.items()}
    base = row.model_dump() if row else dict(user_id=u.id, full_name=u.full_name, email=u.email, phone=u.phone, role=u.role, employee_id=u.employee_id,
                                              designation=u.designation, department=None, date_of_joining=None, gross_monthly=_gross(p), has_bank=False, today=None)
    return StaffDetail(**base, profile=prof, leave_balance=await balances(db, user.school_id, u.id))


async def save_profile(db: AsyncSession, user: User, user_id: uuid.UUID, data: ProfileIn) -> StaffDetail:
    u = await _member(db, user.school_id, user_id)
    p = await db.scalar(select(StaffProfile).where(StaffProfile.user_id == u.id))
    if not p:
        p = StaffProfile(school_id=user.school_id, user_id=u.id)
        db.add(p)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    await db.flush()
    await audit_service.record(db, "hr.profile", school_id=user.school_id, user_id=user.id, entity_type="user", entity_id=u.id,
                               meta={"name": u.full_name, "gross": float(_gross(p))})
    return await detail(db, user, u.id)


# ---- staff attendance -------------------------------------------------------------------------

async def day_sheet(db: AsyncSession, user: User, day: date) -> list[StaffDayRow]:
    staff = await _staff(db, user.school_id)
    marks = {a.user_id: a for a in (await db.scalars(select(StaffAttendance).where(StaffAttendance.school_id == user.school_id,
                                                                                  StaffAttendance.date == day))).all()}
    on_leave = set((await db.scalars(select(StaffLeave.user_id).where(StaffLeave.school_id == user.school_id, StaffLeave.status == "approved",
                                                                       StaffLeave.from_date <= day, StaffLeave.to_date >= day))).all())
    return [StaffDayRow(user_id=u.id, full_name=u.full_name, role=u.role, designation=u.designation,
                        status=marks[u.id].status if u.id in marks else ("leave" if u.id in on_leave else None),
                        check_in=marks[u.id].check_in.strftime("%H:%M") if u.id in marks and marks[u.id].check_in else None,
                        check_out=marks[u.id].check_out.strftime("%H:%M") if u.id in marks and marks[u.id].check_out else None,
                        source=marks[u.id].source if u.id in marks else None, on_leave=u.id in on_leave) for u in staff]


async def mark_day(db: AsyncSession, user: User, day: date, records: list[DayMark]) -> list[StaffDayRow]:
    if day > await school_today(db, user.school_id):
        raise field_error("date", "You can't mark a future date")
    ids = {u.id for u in await _staff(db, user.school_id)}
    existing = {a.user_id: a for a in (await db.scalars(select(StaffAttendance).where(StaffAttendance.school_id == user.school_id,
                                                                                     StaffAttendance.date == day))).all()}
    for i, r in enumerate(records):
        if r.user_id not in ids:
            raise field_error(f"records.{i}.user_id", "Not a staff member")
        a = existing.get(r.user_id) or StaffAttendance(school_id=user.school_id, user_id=r.user_id, date=day)
        a.status, a.check_in, a.check_out, a.source, a.marked_by = r.status, r.check_in, r.check_out, "manual", user.id
        db.add(a)
    await db.flush()
    await audit_service.record(db, "hr.attendance", school_id=user.school_id, user_id=user.id, entity_type="school", entity_id=user.school_id,
                               meta={"date": day.isoformat(), "count": len(records)})
    return await day_sheet(db, user, day)


async def sync_biometric(db: AsyncSession, user: User, day: date) -> int:
    """Turn the day's machine punches by staff into attendance: first punch in, last punch out; late after the cut-off."""
    school = await db.get(School, user.school_id)
    late_after = (school.settings or {}).get("staff_late_after") or (school.settings or {}).get("late_after")
    start = datetime.combine(day, datetime.min.time(), tzinfo=UTC) - timedelta(hours=6)
    rows = (await db.execute(select(BiometricPunch.user_id, func.min(BiometricPunch.punched_at), func.max(BiometricPunch.punched_at))
                             .where(BiometricPunch.school_id == user.school_id, BiometricPunch.user_id.is_not(None),
                                    BiometricPunch.punched_at >= start, BiometricPunch.punched_at < start + timedelta(days=1, hours=12))
                             .group_by(BiometricPunch.user_id))).all()
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(school.timezone or "Asia/Kolkata")
    n = 0
    for uid, first, last in rows:
        first_l, last_l = first.astimezone(tz), last.astimezone(tz)
        if first_l.date() != day:
            continue
        a = await db.scalar(select(StaffAttendance).where(StaffAttendance.user_id == uid, StaffAttendance.date == day))
        if a and a.source == "manual":
            continue  # the office's own marking wins
        a = a or StaffAttendance(school_id=user.school_id, user_id=uid, date=day)
        a.status = "late" if late_after and first_l.strftime("%H:%M") > late_after else "present"
        a.check_in, a.check_out, a.source = first_l.time().replace(microsecond=0), last_l.time().replace(microsecond=0) if last > first else None, "biometric"
        db.add(a)
        n += 1
    await db.flush()
    return n


async def my_attendance(db: AsyncSession, user: User, month: str) -> list[dict]:
    y, m = map(int, month.split("-"))
    rows = (await db.scalars(select(StaffAttendance).where(StaffAttendance.user_id == user.id, StaffAttendance.date >= date(y, m, 1),
                                                           StaffAttendance.date <= date(y, m, calendar.monthrange(y, m)[1]))
                             .order_by(StaffAttendance.date))).all()
    return [{"date": a.date.isoformat(), "status": a.status, "check_in": a.check_in.strftime("%H:%M") if a.check_in else None,
             "check_out": a.check_out.strftime("%H:%M") if a.check_out else None} for a in rows]


# ---- leave ------------------------------------------------------------------------------------

async def leave_types(db: AsyncSession, school_id: uuid.UUID) -> list[LeaveType]:
    rows = list((await db.scalars(select(LeaveType).where(LeaveType.school_id == school_id).order_by(LeaveType.name))).all())
    if not rows:
        for name, code, days, paid in DEFAULT_LEAVE:
            rows.append(LeaveType(school_id=school_id, name=name, code=code, days_per_year=days, paid=paid))
            db.add(rows[-1])
        await db.flush()
    return rows


async def save_leave_type(db: AsyncSession, user: User, data: LeaveTypeIn, tid: uuid.UUID | None = None) -> LeaveTypeOut:
    await leave_types(db, user.school_id)
    clash = await db.scalar(select(LeaveType.id).where(LeaveType.school_id == user.school_id, LeaveType.code == data.code, LeaveType.id != tid))
    if clash:
        raise field_error("code", "This code is already used")
    if tid:
        t = await db.scalar(select(LeaveType).where(LeaveType.id == tid, LeaveType.school_id == user.school_id))
        if not t:
            raise NotFound("Leave type not found")
        for k, v in data.model_dump().items():
            setattr(t, k, v)
    else:
        t = LeaveType(school_id=user.school_id, **data.model_dump())
        db.add(t)
    await db.flush()
    return LeaveTypeOut(id=t.id, **data.model_dump())


def _year_bounds(today: date) -> tuple[date, date]:
    y = today.year if today.month >= 4 else today.year - 1
    return date(y, 4, 1), date(y + 1, 3, 31)


async def balances(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> list[dict]:
    start, end = _year_bounds(await school_today(db, school_id))
    used = dict((await db.execute(select(StaffLeave.leave_type_id, func.sum(StaffLeave.days)).where(
        StaffLeave.user_id == user_id, StaffLeave.status.in_(("approved", "pending")), StaffLeave.from_date >= start, StaffLeave.from_date <= end)
        .group_by(StaffLeave.leave_type_id))).all())
    return [{"id": str(t.id), "name": t.name, "code": t.code, "allowed": t.days_per_year, "used": float(used.get(t.id) or 0),
             "left": max(t.days_per_year - float(used.get(t.id) or 0), 0) if t.paid else None, "paid": t.paid}
            for t in await leave_types(db, school_id) if t.is_active]


async def _leave_out(db: AsyncSession, user: User, rows: list[StaffLeave]) -> list[StaffLeaveOut]:
    types = {t.id: t for t in await leave_types(db, user.school_id)}
    names = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_({r.user_id for r in rows} | {r.decided_by for r in rows if r.decided_by})))).all())
    manage = has_permission(user.role, "hr.manage")
    today = await school_today(db, user.school_id)
    return [StaffLeaveOut(id=r.id, user_id=r.user_id, full_name=names.get(r.user_id, ""), leave_type=types[r.leave_type_id].name,
                          code=types[r.leave_type_id].code, from_date=r.from_date, to_date=r.to_date, half_day=r.half_day, days=r.days, reason=r.reason,
                          status=r.status, decided_by=names.get(r.decided_by), decision_note=r.decision_note, created_at=r.created_at,
                          can_decide=manage and r.status == "pending" and r.user_id != user.id,
                          can_cancel=r.user_id == user.id and (r.status == "pending" or (r.status == "approved" and r.from_date > today)))
            for r in rows]


async def apply_leave(db: AsyncSession, user: User, data: StaffLeaveIn) -> StaffLeaveOut:
    target = user.id
    if data.user_id and data.user_id != user.id:
        if not has_permission(user.role, "hr.manage"):
            raise Forbidden("You can only apply for your own leave", code="PERMISSION_DENIED")
        target = (await _member(db, user.school_id, data.user_id)).id
    if user.role not in STAFF_ROLES and user.role != "driver":
        raise Forbidden("Only staff take staff leave", code="PERMISSION_DENIED")
    t = await db.scalar(select(LeaveType).where(LeaveType.id == data.leave_type_id, LeaveType.school_id == user.school_id, LeaveType.is_active.is_(True)))
    if not t:
        raise field_error("leave_type_id", "Choose a leave type")
    closed = await closed_days(db, user.school_id, data.from_date, data.to_date)
    days = Decimal("0.5") if data.half_day else Decimal(sum(1 for i in range((data.to_date - data.from_date).days + 1)
                                                          if data.from_date + timedelta(days=i) not in closed))
    if days <= 0:
        raise field_error("from_date", "These are all holidays already")
    if await db.scalar(select(StaffLeave.id).where(StaffLeave.user_id == target, StaffLeave.status.in_(("pending", "approved")),
                                                   StaffLeave.from_date <= data.to_date, StaffLeave.to_date >= data.from_date)):
        raise field_error("from_date", "There's already leave covering some of these days")
    if t.paid:
        left = next((b["left"] for b in await balances(db, user.school_id, target) if b["id"] == str(t.id)), 0)
        if left is not None and days > Decimal(str(left)):
            raise field_error("to_date", f"Only {left:g} day(s) of {t.name.lower()} left this year")
    r = StaffLeave(school_id=user.school_id, user_id=target, leave_type_id=t.id, from_date=data.from_date, to_date=data.to_date,
                   half_day=data.half_day, days=days, reason=data.reason)
    db.add(r)
    await db.flush()
    await db.refresh(r)
    if target == user.id:
        hr = (await db.scalars(select(User.id).where(User.school_id == user.school_id, User.is_active.is_(True),
                                                     User.role.in_(["school_admin", "hr_manager"]), User.id != user.id))).all()
        await notification_service.notify(db, hr, school_id=user.school_id, kind="staff_leave", title=f"Leave request: {user.full_name}",
                                          body=f"{t.code} · {data.from_date:%d %b}" + (f" – {data.to_date:%d %b}" if data.to_date != data.from_date else "")
                                          + f" ({days:g} day)", link="/hr?tab=leave")
    return (await _leave_out(db, user, [r]))[0]


async def list_leave(db: AsyncSession, user: User, mine: bool, status: str | None) -> list[StaffLeaveOut]:
    q = select(StaffLeave).where(StaffLeave.school_id == user.school_id)
    if mine or not has_permission(user.role, "hr.view"):
        q = q.where(StaffLeave.user_id == user.id)
    if status:
        q = q.where(StaffLeave.status == status)
    rows = list((await db.scalars(q.order_by(StaffLeave.status != "pending", StaffLeave.from_date.desc()).limit(300))).all())
    return await _leave_out(db, user, rows)


async def decide(db: AsyncSession, user: User, lid: uuid.UUID, approve: bool, note: str | None) -> StaffLeaveOut:
    r = await db.scalar(select(StaffLeave).where(StaffLeave.id == lid, StaffLeave.school_id == user.school_id))
    if not r:
        raise NotFound("Leave not found")
    if r.user_id == user.id:
        raise Forbidden("Someone else must decide your own leave", code="OWN_LEAVE")
    if r.status != "pending":
        raise AppError(f"This request is already {r.status}", code="LEAVE_DECIDED", status_code=409)
    r.status = "approved" if approve else "rejected"
    r.decided_by, r.decided_at, r.decision_note = user.id, datetime.now(UTC), note
    if approve:
        closed = await closed_days(db, user.school_id, r.from_date, r.to_date)
        d = r.from_date
        while d <= r.to_date:
            if d not in closed:
                a = await db.scalar(select(StaffAttendance).where(StaffAttendance.user_id == r.user_id, StaffAttendance.date == d))
                a = a or StaffAttendance(school_id=user.school_id, user_id=r.user_id, date=d)
                a.status, a.source, a.marked_by = ("half_day" if r.half_day else "leave"), "leave", user.id
                db.add(a)
            d += timedelta(days=1)
    await db.flush()
    await notification_service.notify(db, [r.user_id], school_id=user.school_id, kind="staff_leave",
                                      title=f"Leave {r.status}: {r.from_date:%d %b}" + (f" – {r.to_date:%d %b}" if r.to_date != r.from_date else ""),
                                      body=note, link="/my-hr")
    await audit_service.record(db, f"hr.leave_{r.status}", school_id=user.school_id, user_id=user.id, entity_type="user", entity_id=r.user_id,
                               meta={"days": float(r.days)})
    return (await _leave_out(db, user, [r]))[0]


async def cancel(db: AsyncSession, user: User, lid: uuid.UUID) -> StaffLeaveOut:
    r = await db.scalar(select(StaffLeave).where(StaffLeave.id == lid, StaffLeave.user_id == user.id))
    if not r:
        raise NotFound("Leave not found")
    out = (await _leave_out(db, user, [r]))[0]
    if not out.can_cancel:
        raise AppError("This leave can't be withdrawn now", code="LEAVE_DECIDED", status_code=409)
    if r.status == "approved":
        for a in (await db.scalars(select(StaffAttendance).where(StaffAttendance.user_id == r.user_id, StaffAttendance.source == "leave",
                                                                 StaffAttendance.date >= r.from_date, StaffAttendance.date <= r.to_date))).all():
            await db.delete(a)
    r.status = "cancelled"
    await db.flush()
    return (await _leave_out(db, user, [r]))[0]


# ---- payroll ----------------------------------------------------------------------------------

def compute(p: StaffProfile | None, days_in_month: int, lop: Decimal, adjustments: dict) -> tuple[dict, dict, Decimal, Decimal, Decimal]:
    """(earnings, deductions, gross, total deductions, net) for one month."""
    ratio = (Decimal(days_in_month) - lop) / Decimal(days_in_month) if days_in_month else Decimal(1)
    earnings = {k.upper() if k in ("hra", "da") else k.title(): _r((getattr(p, k) or ZERO) * ratio) for k in EARNINGS if p and getattr(p, k)}
    for k, v in adjustments.items():
        if Decimal(str(v)) > 0:
            earnings[k] = _r(Decimal(str(v)))
    gross = sum(earnings.values(), ZERO)
    deductions: dict[str, Decimal] = {}
    if p:
        basic = earnings.get("Basic", ZERO) + earnings.get("DA", ZERO)
        if p.pf_enabled and basic:
            deductions["Provident fund"] = _r(min(basic, Decimal(15000)) * Decimal("0.12"))
        if p.esi_enabled and 0 < gross <= 21000:
            deductions["ESI"] = _r(gross * Decimal("0.0075"))
        if p.professional_tax and gross:
            deductions["Professional tax"] = _r(p.professional_tax)
        if p.tds:
            deductions["Income tax (TDS)"] = _r(p.tds)
    for k, v in adjustments.items():
        if Decimal(str(v)) < 0:
            deductions[k] = _r(-Decimal(str(v)))
    total = sum(deductions.values(), ZERO)
    return ({k: float(v) for k, v in earnings.items()}, {k: float(v) for k, v in deductions.items()}, gross, total, max(gross - total, ZERO))


async def _lop(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID, start: date, end: date) -> Decimal:
    """Days without pay: absences, half of half days, and approved unpaid leave."""
    lop = ZERO
    for status, n in (await db.execute(select(StaffAttendance.status, func.count()).where(
            StaffAttendance.user_id == user_id, StaffAttendance.date >= start, StaffAttendance.date <= end).group_by(StaffAttendance.status))).all():
        if status == "absent":
            lop += n
        elif status == "half_day":
            lop += Decimal("0.5") * n
    unpaid = (await db.execute(select(StaffLeave.from_date, StaffLeave.to_date, StaffLeave.half_day).join(LeaveType, LeaveType.id == StaffLeave.leave_type_id)
                               .where(StaffLeave.user_id == user_id, StaffLeave.status == "approved", LeaveType.paid.is_(False),
                                      StaffLeave.from_date <= end, StaffLeave.to_date >= start))).all()
    closed = await closed_days(db, school_id, start, end)
    for f, t, half in unpaid:
        d = max(f, start)
        while d <= min(t, end):
            if d not in closed:
                lop += Decimal("0.5") if half else 1
            d += timedelta(days=1)
    return lop


async def _run_out(db: AsyncSession, r: PayrollRun, with_slips: bool) -> RunOut:
    slips = list((await db.scalars(select(Payslip).where(Payslip.run_id == r.id))).all())
    out = RunOut(id=r.id, month=r.month, status=r.status, staff=len(slips), gross=sum((s.gross for s in slips), ZERO),
                 net=sum((s.net for s in slips), ZERO), finalised_at=r.finalised_at, paid_on=r.paid_on)
    if with_slips:
        users = {u.id: u for u in (await db.scalars(select(User).where(User.id.in_([s.user_id for s in slips])))).all()}
        profiles = await _profiles(db, users)
        out.payslips = sorted([_slip_out(s, users[s.user_id], profiles.get(s.user_id)) for s in slips], key=lambda x: x.full_name)
    return out


def _slip_out(s: Payslip, u: User, p: StaffProfile | None) -> PayslipOut:
    return PayslipOut(id=s.id, user_id=s.user_id, full_name=u.full_name, employee_id=u.employee_id, designation=u.designation,
                      days_in_month=s.days_in_month, paid_days=s.paid_days, lop_days=s.lop_days, earnings=s.earnings, deductions=s.deductions,
                      adjustments=s.adjustments or {}, gross=s.gross, total_deductions=s.total_deductions, net=s.net, note=s.note,
                      bank_ready=bool(p and p.bank_account and p.ifsc))


async def runs(db: AsyncSession, user: User) -> list[RunOut]:
    return [await _run_out(db, r, False) for r in (await db.scalars(select(PayrollRun).where(PayrollRun.school_id == user.school_id)
                                                                     .order_by(PayrollRun.month.desc()))).all()]


async def _run(db: AsyncSession, user: User, rid: uuid.UUID) -> PayrollRun:
    r = await db.scalar(select(PayrollRun).where(PayrollRun.id == rid, PayrollRun.school_id == user.school_id))
    if not r:
        raise NotFound("Payroll not found")
    return r


async def get_run(db: AsyncSession, user: User, rid: uuid.UUID) -> RunOut:
    return await _run_out(db, await _run(db, user, rid), True)


async def generate(db: AsyncSession, user: User, month: str) -> RunOut:
    """Create (or refresh, while still a draft) the month's payslips."""
    y, m = map(int, month.split("-"))
    start, days = date(y, m, 1), calendar.monthrange(y, m)[1]
    end = date(y, m, days)
    if start > await school_today(db, user.school_id):
        raise field_error("month", "That month hasn't started")
    r = await db.scalar(select(PayrollRun).where(PayrollRun.school_id == user.school_id, PayrollRun.month == month))
    if r and r.status != "draft":
        raise AppError("This month's payroll is finalised", code="PAYROLL_FINAL", status_code=409)
    if not r:
        r = PayrollRun(school_id=user.school_id, month=month, created_by=user.id)
        db.add(r)
        await db.flush()
    existing = {s.user_id: s for s in (await db.scalars(select(Payslip).where(Payslip.run_id == r.id))).all()}
    staff = await _staff(db, user.school_id)
    profiles = await _profiles(db, [u.id for u in staff])
    for u in staff:
        p = profiles.get(u.id)
        if not p or not _gross(p):
            continue  # no salary set up
        if p.date_of_joining and p.date_of_joining > end:
            continue
        lop = await _lop(db, user.school_id, u.id, start, end)
        if p.date_of_joining and p.date_of_joining > start:
            lop += (p.date_of_joining - start).days  # joined mid-month
        lop = min(lop, Decimal(days))
        s = existing.get(u.id)
        adj = (s.adjustments or {}) if s else {}
        earnings, deductions, gross, total, net = compute(p, days, lop, adj)
        if not s:
            s = Payslip(school_id=user.school_id, run_id=r.id, user_id=u.id)
            db.add(s)
        s.days_in_month, s.lop_days, s.paid_days = days, lop, Decimal(days) - lop
        s.earnings, s.deductions, s.gross, s.total_deductions, s.net = earnings, deductions, gross, total, net
    await db.flush()
    await audit_service.record(db, "payroll.generate", school_id=user.school_id, user_id=user.id, entity_type="payroll", entity_id=r.id,
                               meta={"month": month})
    return await _run_out(db, r, True)


async def adjust(db: AsyncSession, user: User, rid: uuid.UUID, sid: uuid.UUID, adjustments: dict, note: str | None) -> RunOut:
    r = await _run(db, user, rid)
    if r.status != "draft":
        raise AppError("This month's payroll is finalised", code="PAYROLL_FINAL", status_code=409)
    s = await db.scalar(select(Payslip).where(Payslip.id == sid, Payslip.run_id == r.id))
    if not s:
        raise NotFound("Payslip not found")
    p = (await _profiles(db, [s.user_id])).get(s.user_id)
    adj = {k: float(v) for k, v in adjustments.items() if v}
    s.adjustments, s.note = adj, note
    s.earnings, s.deductions, s.gross, s.total_deductions, s.net = compute(p, s.days_in_month, s.lop_days, adj)
    await db.flush()
    return await _run_out(db, r, True)


async def finalise(db: AsyncSession, user: User, rid: uuid.UUID) -> RunOut:
    r = await _run(db, user, rid)
    if r.status != "draft":
        raise AppError("Already finalised", code="PAYROLL_FINAL", status_code=409)
    r.status, r.finalised_at = "finalised", datetime.now(UTC)
    slips = (await db.scalars(select(Payslip).where(Payslip.run_id == r.id))).all()
    y, m = map(int, r.month.split("-"))
    await notification_service.notify(db, [s.user_id for s in slips], school_id=user.school_id, kind="payslip",
                                      title=f"Payslip for {calendar.month_name[m]} {y}", body="Open it in My payslips.", link="/my-hr")
    await audit_service.record(db, "payroll.finalise", school_id=user.school_id, user_id=user.id, entity_type="payroll", entity_id=r.id,
                               meta={"month": r.month, "staff": len(slips)})
    return await _run_out(db, r, True)


async def mark_paid(db: AsyncSession, user: User, rid: uuid.UUID, paid_on: date) -> RunOut:
    r = await _run(db, user, rid)
    if r.status == "draft":
        raise AppError("Finalise the payroll first", code="PAYROLL_DRAFT", status_code=409)
    r.status, r.paid_on = "paid", paid_on
    await db.flush()
    return await _run_out(db, r, True)


async def delete_run(db: AsyncSession, user: User, rid: uuid.UUID) -> None:
    r = await _run(db, user, rid)
    if r.status != "draft":
        raise AppError("Only a draft payroll can be deleted", code="PAYROLL_FINAL", status_code=409)
    await db.delete(r)


async def bank_advice(db: AsyncSession, user: User, rid: uuid.UUID) -> str:
    r = await _run(db, user, rid)
    out = await _run_out(db, r, True)
    profiles = await _profiles(db, [s.user_id for s in out.payslips])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["employee_id", "name", "bank", "account_number", "ifsc", "amount", "narration"])
    for s in out.payslips:
        p = profiles.get(s.user_id)
        w.writerow([s.employee_id or "", s.full_name, p.bank_name if p else "", p.bank_account if p else "", p.ifsc if p else "",
                    f"{s.net:.2f}", f"Salary {r.month}"])
    return "﻿" + buf.getvalue()


async def my_payslips(db: AsyncSession, user: User) -> list[dict]:
    rows = (await db.execute(select(Payslip, PayrollRun).join(PayrollRun, PayrollRun.id == Payslip.run_id)
                             .where(Payslip.user_id == user.id, PayrollRun.status != "draft").order_by(PayrollRun.month.desc()))).all()
    return [{"id": str(s.id), "month": r.month, "net": float(s.net), "gross": float(s.gross), "status": r.status,
             "paid_on": r.paid_on.isoformat() if r.paid_on else None} for s, r in rows]


async def payslip_for_pdf(db: AsyncSession, user: User, sid: uuid.UUID) -> tuple[Payslip, PayrollRun, User, StaffProfile | None, School]:
    row = (await db.execute(select(Payslip, PayrollRun).join(PayrollRun, PayrollRun.id == Payslip.run_id)
                            .where(Payslip.id == sid, Payslip.school_id == user.school_id))).first()
    if not row:
        raise NotFound("Payslip not found")
    s, r = row
    if s.user_id != user.id and not has_permission(user.role, "payroll.view"):
        raise NotFound("Payslip not found")
    if s.user_id == user.id and r.status == "draft" and not has_permission(user.role, "payroll.view"):
        raise NotFound("Payslip not found")
    staff = await db.get(User, s.user_id)
    return s, r, staff, (await _profiles(db, [s.user_id])).get(s.user_id), await db.get(School, user.school_id)
