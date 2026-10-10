"""School calendar, leave requests, QR scans and period-wise attendance."""
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import has_permission
from app.models import (
    AttendanceRecord, CalendarEvent, LeaveRequest, PeriodAttendance, Period, School, Section, Student, Subject, Substitution,
    TimetableEntry, User,
)
from app.schemas.attendance_extra import (
    BunkRow, EventIn, EventOut, LeaveDecision, LeaveIn, LeaveOut, PeriodCard, PeriodRoster, PeriodSave, PeriodStudent, ScanOut,
)
from app.services import audit_service, notification_service, sms_service
from app.services.academics_service import field_error
from app.services.family_service import own_students, school_today, student_label
from app.services.timetable_service import _section_labels

CLOSED = ("holiday", "vacation")


# ---- calendar ---------------------------------------------------------------------------------

def _event_out(e: CalendarEvent) -> EventOut:
    return EventOut(id=e.id, title=e.title, kind=e.kind, start_date=e.start_date, end_date=e.end_date, description=e.description,
                    closed=e.kind in CLOSED)


async def list_events(db: AsyncSession, user: User, start: date, end: date) -> list[EventOut]:
    if (end - start).days > 400:
        raise field_error("to", "Choose at most a year")
    rows = await db.scalars(select(CalendarEvent).where(CalendarEvent.school_id == user.school_id, CalendarEvent.start_date <= end,
                                                        CalendarEvent.end_date >= start).order_by(CalendarEvent.start_date))
    return [_event_out(e) for e in rows.all()]


async def closed_reason(db: AsyncSession, school_id: uuid.UUID, day: date) -> str | None:
    """Why the school is closed that day, if it is."""
    if day.weekday() == 6:
        return "Sunday is a holiday."
    e = await db.scalar(select(CalendarEvent).where(CalendarEvent.school_id == school_id, CalendarEvent.kind.in_(CLOSED),
                                                    CalendarEvent.start_date <= day, CalendarEvent.end_date >= day).limit(1))
    return f"{e.title}: the school is closed." if e else None


async def closed_days(db: AsyncSession, school_id: uuid.UUID, start: date, end: date) -> set[date]:
    out = {start + timedelta(days=i) for i in range((end - start).days + 1) if (start + timedelta(days=i)).weekday() == 6}
    for e in (await db.scalars(select(CalendarEvent).where(CalendarEvent.school_id == school_id, CalendarEvent.kind.in_(CLOSED),
                                                           CalendarEvent.start_date <= end, CalendarEvent.end_date >= start))).all():
        d = max(e.start_date, start)
        while d <= min(e.end_date, end):
            out.add(d)
            d += timedelta(days=1)
    return out


async def create_event(db: AsyncSession, user: User, data: EventIn) -> EventOut:
    e = CalendarEvent(school_id=user.school_id, created_by=user.id, **data.model_dump())
    db.add(e)
    await db.flush()
    await audit_service.record(db, "calendar.create", school_id=user.school_id, user_id=user.id, entity_type="event", entity_id=e.id,
                               meta={"title": e.title, "kind": e.kind})
    if e.kind in CLOSED or e.kind == "ptm":
        families = (await db.scalars(select(User.id).where(User.school_id == user.school_id, User.is_active.is_(True)))).all()
        when = f"{e.start_date:%d %b}" + (f" – {e.end_date:%d %b}" if e.end_date != e.start_date else "")
        await notification_service.notify(db, [u for u in families if u != user.id], school_id=user.school_id, kind="calendar",
                                          title=f"{e.title} · {when}", body=e.description, link="/calendar", data={"event_id": e.id})
    return _event_out(e)


async def _event(db: AsyncSession, user: User, event_id: uuid.UUID) -> CalendarEvent:
    e = await db.scalar(select(CalendarEvent).where(CalendarEvent.id == event_id, CalendarEvent.school_id == user.school_id))
    if not e:
        raise NotFound("Event not found")
    return e


async def update_event(db: AsyncSession, user: User, event_id: uuid.UUID, data: EventIn) -> EventOut:
    e = await _event(db, user, event_id)
    for k, v in data.model_dump().items():
        setattr(e, k, v)
    await db.flush()
    return _event_out(e)


async def delete_event(db: AsyncSession, user: User, event_id: uuid.UUID) -> None:
    await db.delete(await _event(db, user, event_id))


# ---- leave requests ---------------------------------------------------------------------------

async def _leave_rows(db: AsyncSession, user: User, rows: list[LeaveRequest]) -> list[LeaveOut]:
    students = {s.id: s for s in (await db.scalars(select(Student).where(Student.id.in_({r.student_id for r in rows})))).all()}
    names = dict((await db.execute(select(User.id, User.full_name).where(
        User.id.in_({r.requested_by for r in rows} | {r.decided_by for r in rows})))).all())
    labels = await _section_labels(db, user.school_id)
    approver_sections = await _approver_sections(db, user)
    family = {k.id for k in await own_students(db, user)}
    out = []
    for r in rows:
        s = students[r.student_id]
        closed = await closed_days(db, user.school_id, r.from_date, r.to_date)
        days = sum(1 for i in range((r.to_date - r.from_date).days + 1) if r.from_date + timedelta(days=i) not in closed)
        out.append(LeaveOut(
            id=r.id, student_id=s.id, student_name=f"{s.first_name} {s.last_name}", class_section=labels.get(s.section_id, ""),
            from_date=r.from_date, to_date=r.to_date, days=days, kind=r.kind, reason=r.reason, status=r.status,
            requested_by=names.get(r.requested_by), requested_at=r.created_at, decided_by=names.get(r.decided_by),
            decided_at=r.decided_at, decision_note=r.decision_note,
            can_decide=r.status == "pending" and (approver_sections is None or s.section_id in approver_sections),
            can_cancel=r.status in ("pending", "approved") and s.id in family))
    return out


async def _approver_sections(db: AsyncSession, user: User) -> set[uuid.UUID] | None:
    """Sections whose leave this user decides. None = all (office); empty = none."""
    if has_permission(user.role, "attendance.manage"):
        return None
    if not has_permission(user.role, "leave.approve"):
        return set()
    return set((await db.scalars(select(Section.id).where(Section.class_teacher_id == user.id))).all())


async def request_leave(db: AsyncSession, user: User, data: LeaveIn) -> LeaveOut:
    kid = next((k for k in await own_students(db, user) if k.id == data.student_id), None)
    if not kid:
        raise NotFound("Student not found")
    today = await school_today(db, user.school_id)
    if data.from_date < today - timedelta(days=7):
        raise field_error("from_date", "Leave can be asked for at most a week after the fact")
    overlap = await db.scalar(select(LeaveRequest.id).where(LeaveRequest.student_id == kid.id, LeaveRequest.status.in_(("pending", "approved")),
                                                            LeaveRequest.from_date <= data.to_date, LeaveRequest.to_date >= data.from_date))
    if overlap:
        raise field_error("from_date", "There is already a leave request covering some of these days")
    r = LeaveRequest(school_id=user.school_id, requested_by=user.id, **data.model_dump())
    db.add(r)
    await db.flush()
    await db.refresh(r)
    section = await db.get(Section, kid.section_id)
    approvers = [section.class_teacher_id] if section and section.class_teacher_id else (await db.scalars(
        select(User.id).where(User.school_id == user.school_id, User.role.in_(["school_admin", "principal"]), User.is_active.is_(True)))).all()
    when = f"{r.from_date:%d %b}" + (f" – {r.to_date:%d %b}" if r.to_date != r.from_date else "")
    await notification_service.notify(db, approvers, school_id=user.school_id, kind="leave",
                                      title=f"Leave request: {kid.first_name} {kid.last_name}", body=f"{when} · {r.reason[:120]}",
                                      link="/leave", data={"leave_id": r.id})
    return (await _leave_rows(db, user, [r]))[0]


async def list_leave(db: AsyncSession, user: User, status: str | None) -> list[LeaveOut]:
    q = select(LeaveRequest).where(LeaveRequest.school_id == user.school_id)
    if user.role in ("parent", "student"):
        q = q.where(LeaveRequest.student_id.in_([k.id for k in await own_students(db, user)]))
    else:
        sections = await _approver_sections(db, user)
        if sections is not None:
            q = q.join(Student, Student.id == LeaveRequest.student_id).where(Student.section_id.in_(sections))
    if status:
        q = q.where(LeaveRequest.status == status)
    rows = list((await db.scalars(q.order_by(LeaveRequest.status != "pending", LeaveRequest.from_date.desc()).limit(200))).all())
    return await _leave_rows(db, user, rows)


async def _leave(db: AsyncSession, user: User, leave_id: uuid.UUID) -> tuple[LeaveRequest, Student]:
    row = (await db.execute(select(LeaveRequest, Student).join(Student, Student.id == LeaveRequest.student_id)
                            .where(LeaveRequest.id == leave_id, LeaveRequest.school_id == user.school_id))).first()
    if not row:
        raise NotFound("Leave request not found")
    return row[0], row[1]


async def _apply_leave(db: AsyncSession, user: User, r: LeaveRequest, s: Student) -> int:
    """Mark the approved days as leave, leaving days already marked present alone."""
    closed = await closed_days(db, user.school_id, r.from_date, r.to_date)
    existing = {a.date: a for a in (await db.scalars(select(AttendanceRecord).where(
        AttendanceRecord.student_id == s.id, AttendanceRecord.date >= r.from_date, AttendanceRecord.date <= r.to_date))).all()}
    n = 0
    now = datetime.now(UTC)
    d = r.from_date
    while d <= r.to_date:
        if d not in closed:
            a = existing.get(d)
            if a is None:
                db.add(AttendanceRecord(school_id=s.school_id, student_id=s.id, section_id=s.section_id, date=d, status="leave",
                                        remark=f"Leave: {r.reason[:150]}", method="leave", marked_by=user.id, marked_at=now))
                n += 1
            elif a.status == "absent":
                a.status, a.remark, a.method, a.marked_by, a.marked_at = "leave", f"Leave: {r.reason[:150]}", "leave", user.id, now
                n += 1
        d += timedelta(days=1)
    return n


async def decide(db: AsyncSession, user: User, leave_id: uuid.UUID, data: LeaveDecision) -> LeaveOut:
    r, s = await _leave(db, user, leave_id)
    sections = await _approver_sections(db, user)
    if sections is not None and s.section_id not in sections:
        raise Forbidden("Only the class teacher or the office can decide this leave", code="NOT_YOUR_CLASS")
    if r.status != "pending":
        raise AppError(f"This request is already {r.status}", code="LEAVE_DECIDED", status_code=409)
    r.status = "approved" if data.approve else "rejected"
    r.decided_by, r.decided_at, r.decision_note = user.id, datetime.now(UTC), data.note or None
    marked = await _apply_leave(db, user, r, s) if data.approve else 0
    await db.flush()
    await audit_service.record(db, f"leave.{r.status}", school_id=user.school_id, user_id=user.id, entity_type="student", entity_id=s.id,
                               meta={"from": r.from_date.isoformat(), "to": r.to_date.isoformat(), "days_marked": marked})
    when = f"{r.from_date:%d %b}" + (f" – {r.to_date:%d %b}" if r.to_date != r.from_date else "")
    await notification_service.notify(db, await notification_service.family_of(db, [s.id]), school_id=user.school_id, kind="leave",
                                      title=f"Leave {r.status}: {s.first_name}, {when}", body=data.note or None, link="/leave",
                                      data={"leave_id": r.id})
    await sms_service.queue(db, school_id=user.school_id, event_name="leave", phones=await sms_service.family_phones(db, [s.id]),
                            body=f"Leave for {s.first_name} ({when}) was {r.status}." + (f" Note: {data.note}" if data.note else ""))
    return (await _leave_rows(db, user, [r]))[0]


async def cancel_leave(db: AsyncSession, user: User, leave_id: uuid.UUID) -> LeaveOut:
    r, s = await _leave(db, user, leave_id)
    if s.id not in {k.id for k in await own_students(db, user)}:
        raise NotFound("Leave request not found")
    if r.status not in ("pending", "approved"):
        raise AppError(f"This request is already {r.status}", code="LEAVE_DECIDED", status_code=409)
    today = await school_today(db, user.school_id)
    if r.status == "approved":
        if r.from_date <= today:
            raise AppError("The leave has started; ask the class teacher to change attendance", code="LEAVE_STARTED", status_code=409)
        for a in (await db.scalars(select(AttendanceRecord).where(AttendanceRecord.student_id == s.id, AttendanceRecord.method == "leave",
                                                                  AttendanceRecord.date >= r.from_date, AttendanceRecord.date <= r.to_date))).all():
            await db.delete(a)
    r.status = "cancelled"
    await db.flush()
    return (await _leave_rows(db, user, [r]))[0]


# ---- QR scan ----------------------------------------------------------------------------------

async def scan(db: AsyncSession, user: User, code: str) -> ScanOut:
    """A student's ID card QR (their admission number) seen at the gate or in class: present today, late after the cut-off."""
    raw = code.strip()
    if raw.lower().startswith("eduvia:"):
        raw = raw.split(":", 1)[1]
    s = await db.scalar(select(Student).where(Student.school_id == user.school_id, Student.status == "active",
                                              or_(Student.admission_no.ilike(raw), Student.biometric_id == raw)))
    if not s:
        raise NotFound("No active student has this card")
    if user.role == "teacher":  # in class, the incharge marks their own class; the gate (guards, office) marks anyone arriving
        from app.services.academics_service import class_teacher_sections
        if s.section_id not in await class_teacher_sections(db, user):
            raise Forbidden(f"{s.first_name} isn't in your class. Only their class teacher can mark them.", code="NOT_YOUR_SECTION")
    school = await db.get(School, user.school_id)
    now = datetime.now(ZoneInfo(school.timezone or "Asia/Kolkata"))
    today = now.date()
    if reason := await closed_reason(db, user.school_id, today):
        raise AppError(reason, code="SCHOOL_CLOSED", status_code=409)
    late_after = (school.settings or {}).get("late_after")  # "08:15"
    status = "late" if late_after and now.strftime("%H:%M") > late_after else "present"
    rec = await db.scalar(select(AttendanceRecord).where(AttendanceRecord.student_id == s.id, AttendanceRecord.date == today))
    already = bool(rec and rec.status in ("present", "late", "half_day"))
    if rec is None:
        db.add(AttendanceRecord(school_id=s.school_id, student_id=s.id, section_id=s.section_id, date=today, status=status,
                                method="qr", marked_by=user.id, marked_at=now))
    elif not already:  # was absent or on leave, but has turned up
        rec.status, rec.method, rec.marked_by, rec.marked_at = status, "qr", user.id, now
    await db.flush()
    final = rec.status if rec and already else status
    return ScanOut(student_id=s.id, name=f"{s.first_name} {s.last_name}", class_section=await student_label(db, s),
                   photo_file_id=s.photo_file_id, status=final, already=already, time=now)


# ---- period-wise ------------------------------------------------------------------------------

async def _my_entries(db: AsyncSession, user: User, day: date) -> list[tuple[TimetableEntry, bool]]:
    """Today's periods this teacher takes: their own (unless covered by someone) and those they cover."""
    covered_away = set((await db.scalars(select(Substitution.entry_id).where(Substitution.date == day,
                                                                              Substitution.absent_teacher_id == user.id))).all())
    own = (await db.scalars(select(TimetableEntry).where(TimetableEntry.teacher_id == user.id, TimetableEntry.day == day.isoweekday()))).all()
    cover_ids = (await db.scalars(select(Substitution.entry_id).where(Substitution.date == day, Substitution.substitute_id == user.id))).all()
    covers = (await db.scalars(select(TimetableEntry).where(TimetableEntry.id.in_(cover_ids)))).all() if cover_ids else []
    return [(e, False) for e in own if e.id not in covered_away] + [(e, True) for e in covers]


async def my_periods(db: AsyncSession, user: User, day: date) -> list[PeriodCard]:
    entries = await _my_entries(db, user, day)
    if not entries:
        return []
    labels = await _section_labels(db, user.school_id)
    periods = {p.id: p for p in (await db.scalars(select(Period).where(Period.school_id == user.school_id))).all()}
    subjects = {s.id: s for s in (await db.scalars(select(Subject).where(Subject.school_id == user.school_id))).all()}
    taken = {p.entry_id: p for p in (await db.scalars(select(PeriodAttendance).where(
        PeriodAttendance.date == day, PeriodAttendance.entry_id.in_([e.id for e, _ in entries])))).all()}
    out = [PeriodCard(entry_id=e.id, period_name=periods[e.period_id].name, start_time=periods[e.period_id].start_time.strftime("%H:%M"),
                      end_time=periods[e.period_id].end_time.strftime("%H:%M"), section_id=e.section_id,
                      section_label=labels.get(e.section_id, ""), subject_name=subjects[e.subject_id].name,
                      subject_color=subjects[e.subject_id].color, marked=e.id in taken,
                      absent=len(taken[e.id].absent_ids) if e.id in taken else 0, cover=cover) for e, cover in entries]
    return sorted(out, key=lambda c: c.start_time)


async def _entry_for(db: AsyncSession, user: User, entry_id: uuid.UUID, day: date) -> TimetableEntry:
    e = await db.scalar(select(TimetableEntry).where(TimetableEntry.id == entry_id, TimetableEntry.school_id == user.school_id))
    if not e:
        raise NotFound("Period not found")
    if e.day != day.isoweekday():
        raise field_error("date", "This period isn't on that day")
    if not has_permission(user.role, "attendance.manage") and e.id not in {x.id for x, _ in await _my_entries(db, user, day)}:
        raise Forbidden("You can only take attendance for your own periods", code="NOT_YOUR_PERIOD")
    return e


async def period_roster(db: AsyncSession, user: User, entry_id: uuid.UUID, day: date) -> PeriodRoster:
    e = await _entry_for(db, user, entry_id, day)
    students = (await db.scalars(select(Student).where(Student.section_id == e.section_id, Student.status == "active")
                                 .order_by(Student.roll_no.nulls_last(), Student.first_name))).all()
    day_status = dict((await db.execute(select(AttendanceRecord.student_id, AttendanceRecord.status).where(
        AttendanceRecord.section_id == e.section_id, AttendanceRecord.date == day))).all())
    taken = await db.scalar(select(PeriodAttendance).where(PeriodAttendance.entry_id == e.id, PeriodAttendance.date == day))
    absent = set(taken.absent_ids) if taken else {s.id for s in students if day_status.get(s.id) in ("absent", "leave")}
    labels = await _section_labels(db, user.school_id)
    period = await db.get(Period, e.period_id)
    subject = await db.get(Subject, e.subject_id)
    return PeriodRoster(entry_id=e.id, date=day, label=f"{labels.get(e.section_id, '')} · {subject.name} · {period.name}", marked=taken is not None,
                        students=[PeriodStudent(student_id=s.id, name=f"{s.first_name} {s.last_name}", roll_no=s.roll_no,
                                                day_status=day_status.get(s.id), absent=s.id in absent) for s in students])


async def save_period(db: AsyncSession, user: User, entry_id: uuid.UUID, data: PeriodSave) -> PeriodRoster:
    today = await school_today(db, user.school_id)
    if data.date > today:
        raise field_error("date", "You can't take attendance for a future date")
    if not has_permission(user.role, "attendance.manage") and (today - data.date).days > 3:
        raise field_error("date", "Period attendance older than 3 days can only be changed by the office")
    e = await _entry_for(db, user, entry_id, data.date)
    in_section = set((await db.scalars(select(Student.id).where(Student.section_id == e.section_id, Student.status == "active"))).all())
    for i, sid in enumerate(data.absent_ids):
        if sid not in in_section:
            raise field_error(f"absent_ids.{i}", "This student isn't in the class")
    row = await db.scalar(select(PeriodAttendance).where(PeriodAttendance.entry_id == e.id, PeriodAttendance.date == data.date))
    if row is None:
        row = PeriodAttendance(school_id=user.school_id, entry_id=e.id, section_id=e.section_id, date=data.date)
        db.add(row)
    row.absent_ids, row.marked_by, row.marked_at = list(dict.fromkeys(data.absent_ids)), user.id, datetime.now(UTC)
    await db.flush()
    return await period_roster(db, user, entry_id, data.date)


async def bunks(db: AsyncSession, user: User, day: date, section_id: uuid.UUID | None) -> list[BunkRow]:
    """Students present at roll call who missed one or more periods that day."""
    q = select(PeriodAttendance, TimetableEntry, Period).join(TimetableEntry, TimetableEntry.id == PeriodAttendance.entry_id).join(
        Period, Period.id == TimetableEntry.period_id).where(PeriodAttendance.school_id == user.school_id, PeriodAttendance.date == day)
    if section_id:
        q = q.where(PeriodAttendance.section_id == section_id)
    missed: dict[uuid.UUID, list[str]] = defaultdict(list)
    for pa, _, p in (await db.execute(q.order_by(Period.sort_order))).all():
        for sid in pa.absent_ids:
            missed[sid].append(p.name)
    if not missed:
        return []
    present = dict((await db.execute(select(AttendanceRecord.student_id, AttendanceRecord.status).where(
        AttendanceRecord.student_id.in_(list(missed)), AttendanceRecord.date == day,
        AttendanceRecord.status.in_(("present", "late"))))).all())
    students = {s.id: s for s in (await db.scalars(select(Student).where(Student.id.in_(list(present))))).all()}
    labels = await _section_labels(db, user.school_id)
    return [BunkRow(student_id=sid, name=f"{s.first_name} {s.last_name}", section_label=labels.get(s.section_id, ""), periods=missed[sid])
            for sid, s in sorted(students.items(), key=lambda x: (labels.get(x[1].section_id, ""), x[1].first_name))]

