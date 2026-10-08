"""Cover for absent teachers: mark a teacher away for a day, then give each of their periods to someone free."""
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.models import Period, Subject, Substitution, TimetableEntry, User
from app.schemas.academics_extra import SubstituteSet, SubstitutionDay, SubstitutionOut
from app.schemas.timetable import AvailableTeacher
from app.services import audit_service, notification_service
from app.services.academics_service import field_error
from app.services.family_service import school_today
from app.services.timetable_service import _get_teacher, _section_labels, available_teachers


async def _rows(db: AsyncSession, school_id: uuid.UUID, *where) -> list[SubstitutionOut]:
    labels = await _section_labels(db, school_id)
    rows = (await db.execute(
        select(Substitution, TimetableEntry, Period, Subject).join(TimetableEntry, TimetableEntry.id == Substitution.entry_id)
        .join(Period, Period.id == TimetableEntry.period_id).join(Subject, Subject.id == TimetableEntry.subject_id)
        .where(Substitution.school_id == school_id, *where).order_by(Substitution.date, Period.sort_order, Period.start_time))).all()
    names = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_(
        {s.absent_teacher_id for s, *_ in rows} | {s.substitute_id for s, *_ in rows})))).all())
    return [SubstitutionOut(id=s.id, date=s.date, period_id=p.id, period_name=p.name, start_time=p.start_time.strftime("%H:%M"),
                            end_time=p.end_time.strftime("%H:%M"), section_id=e.section_id, section_label=labels.get(e.section_id, ""),
                            subject_name=subj.name, subject_color=subj.color, absent_teacher_id=s.absent_teacher_id,
                            absent_teacher=names.get(s.absent_teacher_id), substitute_id=s.substitute_id,
                            substitute=names.get(s.substitute_id), note=s.note) for s, e, p, subj in rows]


async def day(db: AsyncSession, user: User, d: date) -> SubstitutionDay:
    periods = await _rows(db, user.school_id, Substitution.date == d)
    teachers: dict[uuid.UUID, dict] = {}
    for p in periods:
        t = teachers.setdefault(p.absent_teacher_id, {"id": str(p.absent_teacher_id), "full_name": p.absent_teacher, "periods": 0, "covered": 0})
        t["periods"] += 1
        t["covered"] += p.substitute_id is not None
    return SubstitutionDay(date=d, absent_teachers=sorted(teachers.values(), key=lambda t: t["full_name"] or ""), periods=periods)


async def mark_absent(db: AsyncSession, user: User, d: date, teacher_id: uuid.UUID) -> SubstitutionDay:
    """Every period the teacher has that weekday gets a row waiting for a substitute."""
    teacher = await _get_teacher(db, user.school_id, teacher_id)
    if d < await school_today(db, user.school_id):
        raise field_error("date", "Choose today or a later date")
    entries = (await db.scalars(select(TimetableEntry).where(TimetableEntry.school_id == user.school_id,
                                                             TimetableEntry.teacher_id == teacher.id,
                                                             TimetableEntry.day == d.isoweekday()))).all()
    if not entries:
        raise field_error("teacher_id", f"{teacher.full_name} has no periods on {d:%A}")
    have = set((await db.scalars(select(Substitution.entry_id).where(Substitution.date == d,
                                                                     Substitution.entry_id.in_([e.id for e in entries])))).all())
    for e in entries:
        if e.id not in have:
            db.add(Substitution(school_id=user.school_id, date=d, entry_id=e.id, absent_teacher_id=teacher.id, created_by=user.id))
    # They can't cover anyone else that day.
    for s in (await db.scalars(select(Substitution).where(Substitution.date == d, Substitution.substitute_id == teacher.id))).all():
        s.substitute_id = None
    await db.flush()
    await audit_service.record(db, "substitution.absent", school_id=user.school_id, user_id=user.id, entity_type="user",
                               entity_id=teacher.id, meta={"date": d.isoformat(), "name": teacher.full_name})
    return await day(db, user, d)


async def clear_absent(db: AsyncSession, user: User, d: date, teacher_id: uuid.UUID) -> SubstitutionDay:
    for s in (await db.scalars(select(Substitution).where(Substitution.school_id == user.school_id, Substitution.date == d,
                                                          Substitution.absent_teacher_id == teacher_id))).all():
        await db.delete(s)
    await db.flush()
    return await day(db, user, d)


async def _get(db: AsyncSession, user: User, sub_id: uuid.UUID) -> tuple[Substitution, TimetableEntry]:
    row = (await db.execute(select(Substitution, TimetableEntry).join(TimetableEntry, TimetableEntry.id == Substitution.entry_id)
                            .where(Substitution.id == sub_id, Substitution.school_id == user.school_id))).first()
    if not row:
        raise NotFound("Substitution not found")
    return row[0], row[1]


async def candidates(db: AsyncSession, user: User, sub_id: uuid.UUID) -> list[AvailableTeacher]:
    """Teachers for this period, best first: free that period (in the timetable and for other covers), then qualified."""
    s, e = await _get(db, user, sub_id)
    out = await available_teachers(db, user.school_id, day=e.day, period_id=e.period_id, subject_id=e.subject_id, section_id=None)
    away = set((await db.scalars(select(Substitution.absent_teacher_id).where(Substitution.date == s.date))).all())
    covering = dict((await db.execute(select(Substitution.substitute_id, Substitution.id).join(TimetableEntry, TimetableEntry.id == Substitution.entry_id)
                                      .where(Substitution.date == s.date, TimetableEntry.period_id == e.period_id,
                                             Substitution.substitute_id.is_not(None)))).all())
    result = []
    for a in out:
        if a.id in away:
            continue
        if a.id in covering and covering[a.id] != s.id:
            a.status, a.busy_with = "busy", "another cover"
        result.append(a)
    rank = {"current": 0, "free": 1, "busy": 2, "unavailable": 3}
    result.sort(key=lambda a: (rank[a.status], not a.qualified, a.periods_that_day, a.full_name))
    return result


async def assign(db: AsyncSession, user: User, sub_id: uuid.UUID, data: SubstituteSet) -> SubstitutionOut:
    s, e = await _get(db, user, sub_id)
    if data.substitute_id:
        teacher = await _get_teacher(db, user.school_id, data.substitute_id, "substitute_id")
        options = {a.id: a for a in await candidates(db, user, sub_id)}
        a = options.get(teacher.id)
        if not a:
            raise field_error("substitute_id", f"{teacher.full_name} is away that day")
        if a.status == "busy":
            raise field_error("substitute_id", f"{teacher.full_name} is teaching {a.busy_with} that period")
        changed = s.substitute_id != teacher.id
        s.substitute_id = teacher.id
        if changed:
            row = (await _rows(db, user.school_id, Substitution.id == s.id))[0]
            await notification_service.notify(
                db, [teacher.id], school_id=user.school_id, kind="substitution",
                title=f"Cover: {row.section_label} {row.subject_name}, {row.period_name}",
                body=f"{s.date:%A %d %b} · {row.start_time}–{row.end_time} for {row.absent_teacher or 'a colleague'}",
                link="/my-timetable", data={"substitution_id": s.id})
    else:
        s.substitute_id = None
    s.note = data.note or None
    await db.flush()
    return (await _rows(db, user.school_id, Substitution.id == s.id))[0]


async def mine(db: AsyncSession, user: User) -> list[SubstitutionOut]:
    """Covers this teacher has been given, from today on."""
    today = await school_today(db, user.school_id)
    return await _rows(db, user.school_id, Substitution.substitute_id == user.id, Substitution.date >= today)


async def section_ids_covered(db: AsyncSession, user: User, d: date) -> set[uuid.UUID]:
    """Sections this teacher covers on a day (so they may take that day's attendance)."""
    rows = await db.scalars(select(TimetableEntry.section_id).join(Substitution, Substitution.entry_id == TimetableEntry.id)
                            .where(Substitution.substitute_id == user.id, Substitution.date == d))
    return set(rows.all())
