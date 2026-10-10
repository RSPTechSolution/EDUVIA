"""Daily attendance: who may mark which section, marking, and reports."""
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import has_permission
from app.models import AttendanceRecord, SchoolClass, Section, Student, TimetableEntry, User
from app.schemas.attendance import (
    Counts, DayStatus, MarkRequest, Overview, ReportRow, Roster, RosterEntry, SectionCard, SectionReport,
    StudentAttendance, TrendPoint,
)
from app.services import audit_service, notification_service, sms_service
from app.services.academics_service import field_error, get_section
from app.services.attendance_extra_service import closed_reason
from app.services.family_service import school_today, student_label

TEACHER_EDIT_DAYS = 3  # teachers can correct the last few days; admins any past date
LOW_ATTENDANCE = 75.0


def month_range(month: str) -> tuple[date, date]:
    try:
        y, m = (int(x) for x in month.split("-"))
        start = date(y, m, 1)
    except (ValueError, TypeError):
        raise field_error("month", "Use the format YYYY-MM") from None
    end = date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)
    return start, end


def academic_year_start(d: date) -> date:
    """Indian schools start the year in April."""
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def _counts(statuses) -> Counts:
    c = Counts()
    for s in statuses:
        setattr(c, s, getattr(c, s) + 1)
    return c


async def _labels(db: AsyncSession, school_id: uuid.UUID) -> list[tuple[Section, str, str | None]]:
    rows = await db.execute(
        select(Section, SchoolClass.name, User.full_name).join(SchoolClass, SchoolClass.id == Section.class_id)
        .outerjoin(User, User.id == Section.class_teacher_id)
        .where(Section.school_id == school_id).order_by(SchoolClass.sort_order, Section.name))
    return [(s, f"{c} – {s.name}", t) for s, c, t in rows.all()]


async def markable_section_ids(db: AsyncSession, user: User) -> set[uuid.UUID] | None:
    """Sections listed for this user. None means every section: admins, and view-only office staff
    (who can look but never mark). Teachers: only the sections they are class teacher (incharge) of."""
    if has_permission(user.role, "attendance.manage") or not has_permission(user.role, "attendance.mark"):
        return None
    from app.services.academics_service import class_teacher_sections
    return await class_teacher_sections(db, user)


async def _check_can_mark(db: AsyncSession, user: User, section_id: uuid.UUID) -> None:
    allowed = await markable_section_ids(db, user)
    if allowed is not None and section_id not in allowed:
        raise Forbidden("Only the class teacher (incharge) of this class can take its attendance", code="NOT_YOUR_SECTION")


async def _active_students(db: AsyncSession, section_id: uuid.UUID) -> list[Student]:
    return list((await db.scalars(select(Student).where(Student.section_id == section_id, Student.status == "active")
                                  .order_by(Student.roll_no.nulls_last(), Student.first_name))).all())


async def list_sections(db: AsyncSession, user: User, day: date) -> list[SectionCard]:
    school_id = user.school_id
    allowed = await markable_section_ids(db, user)
    labels = [x for x in await _labels(db, school_id) if allowed is None or x[0].id in allowed]
    ids = [s.id for s, _, _ in labels]
    students = dict((await db.execute(select(Student.section_id, func.count()).where(
        Student.section_id.in_(ids), Student.status == "active").group_by(Student.section_id))).all())
    marks: dict[uuid.UUID, list[str]] = defaultdict(list)
    marker: dict[uuid.UUID, uuid.UUID] = {}
    for sid, status, by in (await db.execute(select(AttendanceRecord.section_id, AttendanceRecord.status, AttendanceRecord.marked_by)
                                             .where(AttendanceRecord.section_id.in_(ids), AttendanceRecord.date == day))).all():
        marks[sid].append(status)
        if by:
            marker[sid] = by
    names = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_(set(marker.values()))))).all()) if marker else {}
    out = []
    for s, label, teacher in labels:
        c = _counts(marks[s.id])
        out.append(SectionCard(section_id=s.id, label=label, class_teacher=teacher, is_class_teacher=s.class_teacher_id == user.id,
                               students=students.get(s.id, 0), marked=c.marked, present=c.present + c.late + c.half_day,
                               absent=c.absent, marked_by=names.get(marker.get(s.id))))
    # A teacher's own class first.
    return sorted(out, key=lambda c: not c.is_class_teacher)


async def roster(db: AsyncSession, user: User, section_id: uuid.UUID, day: date) -> Roster:
    section = await get_section(db, user.school_id, section_id)
    today = await school_today(db, user.school_id)
    if day > today:
        raise field_error("date", "You can't take attendance for a future date")
    can_mark = has_permission(user.role, "attendance.mark")
    if can_mark:
        try:
            await _check_can_mark(db, user, section.id)
        except Forbidden:
            can_mark = False
    locked = None
    if not can_mark:
        locked = "Only the class teacher (incharge) can take this class's attendance."
    elif not has_permission(user.role, "attendance.manage") and (today - day).days > TEACHER_EDIT_DAYS:
        locked = f"Attendance older than {TEACHER_EDIT_DAYS} days can only be changed by the office."
    elif closed := await closed_reason(db, user.school_id, day):
        locked = closed

    students = await _active_students(db, section.id)
    records = {r.student_id: r for r in (await db.scalars(select(AttendanceRecord).where(
        AttendanceRecord.section_id == section.id, AttendanceRecord.date == day))).all()}
    recent: dict[uuid.UUID, list[str]] = defaultdict(list)  # last 30 days, so early-month numbers aren't misleading
    for sid, status in (await db.execute(select(AttendanceRecord.student_id, AttendanceRecord.status).where(
            AttendanceRecord.student_id.in_([s.id for s in students]),
            AttendanceRecord.date > day - timedelta(days=30), AttendanceRecord.date <= day))).all():
        recent[sid].append(status)
    last = max(records.values(), key=lambda r: r.marked_at, default=None)
    marker = await db.scalar(select(User.full_name).where(User.id == last.marked_by)) if last and last.marked_by else None
    label = await _section_label(db, section)
    return Roster(
        section_id=section.id, label=label, date=day, editable=locked is None, locked_reason=locked,
        marked_by=marker, marked_at=last.marked_at if last else None,
        students=[RosterEntry(student_id=s.id, name=f"{s.first_name} {s.last_name}", admission_no=s.admission_no,
                              roll_no=s.roll_no, gender=s.gender, status=records[s.id].status if s.id in records else None,
                              remark=records[s.id].remark if s.id in records else None,
                              recent_percent=_counts(recent[s.id]).percent()) for s in students],
        counts=_counts(r.status for r in records.values()))


async def _section_label(db: AsyncSession, section: Section) -> str:
    cname = await db.scalar(select(SchoolClass.name).where(SchoolClass.id == section.class_id))
    return f"{cname} – {section.name}"


async def mark(db: AsyncSession, user: User, section_id: uuid.UUID, data: MarkRequest) -> Roster:
    await _check_can_mark(db, user, (await get_section(db, user.school_id, section_id)).id)  # only the incharge (or the office)
    r = await roster(db, user, section_id, data.date)
    if not r.editable:
        raise AppError(r.locked_reason or "Attendance can't be changed", code="ATTENDANCE_LOCKED", status_code=403)
    in_section = {s.student_id for s in r.students}
    for i, rec in enumerate(data.records):
        if rec.student_id not in in_section:
            raise field_error(f"records.{i}.student_id", "This student isn't in the section")
    existing = {x.student_id: x for x in (await db.scalars(select(AttendanceRecord).where(
        AttendanceRecord.student_id.in_(in_section), AttendanceRecord.date == data.date))).all()}
    changed = 0
    now = datetime.now(UTC)
    newly_absent = []
    for rec in data.records:
        row = existing.get(rec.student_id)
        if rec.status == "absent" and (row is None or row.status != "absent"):
            newly_absent.append(rec.student_id)
        if row is None:
            db.add(AttendanceRecord(school_id=user.school_id, student_id=rec.student_id, section_id=section_id, date=data.date,
                                    status=rec.status, remark=rec.remark or None, marked_by=user.id, marked_at=now))
            changed += 1
        elif row.status != rec.status or row.remark != (rec.remark or None):
            row.status, row.remark, row.marked_by, row.section_id, row.marked_at = rec.status, rec.remark or None, user.id, section_id, now
            changed += 1
    await db.flush()
    if newly_absent and data.date == await school_today(db, user.school_id):
        names = {st.student_id: st.name for st in r.students}
        for sid in newly_absent:
            await notification_service.notify(db, await notification_service.family_of(db, [sid]), school_id=user.school_id,
                                              kind="absent", title=f"{names.get(sid, 'Your child')} was marked absent today",
                                              body=f"{r.label} · {data.date:%d %b %Y}. Contact the class teacher if this is a mistake.",
                                              link="/my-attendance", data={"student_id": sid})
            await sms_service.queue(db, school_id=user.school_id, event_name="absent", phones=await sms_service.family_phones(db, [sid]),
                                    body=f"{names.get(sid, 'Your child')} was marked absent at school today, {data.date:%d %b}. "
                                         "Please contact the class teacher if this is a mistake.")
    c = _counts(x.status for x in data.records)
    await audit_service.record(db, "attendance.mark", school_id=user.school_id, user_id=user.id, entity_type="section",
                               entity_id=section_id, meta={"date": data.date.isoformat(), "present": c.present + c.late,
                                                           "absent": c.absent, "changed": changed, "label": r.label})
    return await roster(db, user, section_id, data.date)


async def student_attendance(db: AsyncSession, student: Student, month: str) -> StudentAttendance:
    start, end = month_range(month)
    year_start = academic_year_start(end)
    rows = (await db.scalars(select(AttendanceRecord).where(
        AttendanceRecord.student_id == student.id, AttendanceRecord.date >= min(start, year_start),
        AttendanceRecord.date <= end).order_by(AttendanceRecord.date))).all()
    in_month = [r for r in rows if start <= r.date <= end]
    month_c = _counts(r.status for r in in_month)
    year_c = _counts(r.status for r in rows if r.date >= year_start)
    return StudentAttendance(
        student_id=student.id, name=f"{student.first_name} {student.last_name}", class_section=await student_label(db, student),
        month=month, days=[DayStatus(date=r.date, status=r.status, remark=r.remark) for r in in_month],
        month_counts=month_c, month_percent=month_c.percent(), year_counts=year_c, year_percent=year_c.percent())


async def section_report(db: AsyncSession, user: User, section_id: uuid.UUID, month: str) -> SectionReport:
    section = await get_section(db, user.school_id, section_id)
    start, end = month_range(month)
    students = await _active_students(db, section.id)
    per: dict[uuid.UUID, list[str]] = defaultdict(list)
    days: set[date] = set()
    for sid, d, status in (await db.execute(select(AttendanceRecord.student_id, AttendanceRecord.date, AttendanceRecord.status).where(
            AttendanceRecord.section_id == section.id, AttendanceRecord.date >= start, AttendanceRecord.date <= end))).all():
        per[sid].append(status)
        days.add(d)
    rows = [ReportRow(student_id=s.id, name=f"{s.first_name} {s.last_name}", roll_no=s.roll_no,
                      counts=_counts(per[s.id]), percent=_counts(per[s.id]).percent()) for s in students]
    pcts = [r.percent for r in rows if r.percent is not None]
    return SectionReport(section_id=section.id, label=await _section_label(db, section), month=month, school_days=len(days),
                         rows=rows, average_percent=round(sum(pcts) / len(pcts), 1) if pcts else None)


async def overview(db: AsyncSession, user: User, day: date) -> Overview:
    school_id = user.school_id
    cards = await list_sections(db, user, day)
    statuses = (await db.scalars(select(AttendanceRecord.status).where(
        AttendanceRecord.school_id == school_id, AttendanceRecord.date == day))).all()
    c = _counts(statuses)
    # Two weeks of school days.
    since = day - timedelta(days=20)
    daily: dict[date, list[str]] = defaultdict(list)
    for d, status in (await db.execute(select(AttendanceRecord.date, AttendanceRecord.status).where(
            AttendanceRecord.school_id == school_id, AttendanceRecord.date >= since, AttendanceRecord.date <= day))).all():
        daily[d].append(status)
    trend = [TrendPoint(date=d, percent=_counts(v).percent(), marked=len(v)) for d, v in sorted(daily.items())][-14:]
    # Students below 75% over the last 30 days.
    per: dict[uuid.UUID, list[str]] = defaultdict(list)
    for sid, status in (await db.execute(select(AttendanceRecord.student_id, AttendanceRecord.status).where(
            AttendanceRecord.school_id == school_id, AttendanceRecord.date > day - timedelta(days=30), AttendanceRecord.date <= day))).all():
        per[sid].append(status)
    low_ids = [sid for sid, v in per.items() if len(v) >= 5 and (_counts(v).percent() or 100) < LOW_ATTENDANCE]
    low = []
    if low_ids:
        for s in (await db.scalars(select(Student).where(Student.id.in_(low_ids), Student.status == "active"))).all():
            low.append(ReportRow(student_id=s.id, name=f"{s.first_name} {s.last_name} · {await student_label(db, s)}",
                                 roll_no=s.roll_no, counts=_counts(per[s.id]), percent=_counts(per[s.id]).percent()))
    total = await db.scalar(select(func.count()).select_from(Student).where(Student.school_id == school_id, Student.status == "active"))
    return Overview(date=day, sections_total=len(cards), sections_marked=sum(1 for x in cards if x.marked), students_total=total or 0,
                    counts=c, percent=c.percent(), sections=cards, trend=trend,
                    low_attendance=sorted(low, key=lambda r: r.percent or 0)[:20])


async def get_student(db: AsyncSession, school_id: uuid.UUID, student_id: uuid.UUID) -> Student:
    s = await db.scalar(select(Student).where(Student.id == student_id, Student.school_id == school_id))
    if not s:
        raise NotFound("Student not found")
    return s
