"""Syllabus topics per class and subject, progress per section, and teachers' lesson plans.

Teachers work on the classes and subjects they teach (from the timetable) or the sections they are
class teacher of; admins and principals on everything. Families see coverage for their children.
"""
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Forbidden, NotFound
from app.models import LessonPlan, SchoolClass, Section, Subject, SyllabusTopic, TopicProgress, User
from app.schemas.academics_extra import (
    ChildSyllabus, CoverageRow, LessonIn, LessonOut, LessonUpdate, ProgressSet, SyllabusView, TopicIn, TopicOut, TopicsBulk,
    TopicUpdate,
)
from app.services import audit_service
from app.services.academics_service import field_error, get_class, get_section
from app.services.family_service import own_students, school_today, student_label
from app.services.homework_service import _allowed, _labels, _scope


async def _subject(db: AsyncSession, school_id: uuid.UUID, subject_id: uuid.UUID) -> Subject:
    s = await db.scalar(select(Subject).where(Subject.id == subject_id, Subject.school_id == school_id))
    if not s:
        raise field_error("subject_id", "Choose a subject from your school")
    return s


async def _class_sections(db: AsyncSession, class_id: uuid.UUID) -> list[Section]:
    return list((await db.scalars(select(Section).where(Section.class_id == class_id).order_by(Section.name))).all())


async def _may_edit_topics(db: AsyncSession, user: User, scope, class_id: uuid.UUID, subject_id: uuid.UUID) -> bool:
    return scope is None or any(_allowed(scope, s.id, subject_id) for s in await _class_sections(db, class_id))


async def _topic(db: AsyncSession, school_id: uuid.UUID, topic_id: uuid.UUID) -> SyllabusTopic:
    t = await db.scalar(select(SyllabusTopic).where(SyllabusTopic.id == topic_id, SyllabusTopic.school_id == school_id))
    if not t:
        raise NotFound("Topic not found")
    return t


# ---- topics -----------------------------------------------------------------------------------

async def view(db: AsyncSession, user: User, class_id: uuid.UUID, subject_id: uuid.UUID) -> SyllabusView:
    c = await get_class(db, user.school_id, class_id)
    subj = await _subject(db, user.school_id, subject_id)
    scope = await _scope(db, user)
    sections = await _class_sections(db, class_id)
    topics = (await db.scalars(select(SyllabusTopic).where(SyllabusTopic.class_id == class_id, SyllabusTopic.subject_id == subject_id)
                               .order_by(SyllabusTopic.sort_order, SyllabusTopic.created_at))).all()
    done: dict[uuid.UUID, dict[str, date]] = {}
    for p in (await db.scalars(select(TopicProgress).where(TopicProgress.topic_id.in_([t.id for t in topics])))).all():
        done.setdefault(p.topic_id, {})[str(p.section_id)] = p.completed_on
    return SyllabusView(
        class_id=c.id, class_name=c.name, subject_id=subj.id, subject_name=subj.name,
        sections=[{"id": str(s.id), "name": s.name, "editable": _allowed(scope, s.id, subject_id)} for s in sections],
        can_edit_topics=await _may_edit_topics(db, user, scope, class_id, subject_id),
        topics=[TopicOut(id=t.id, unit=t.unit, title=t.title, planned_month=t.planned_month, sort_order=t.sort_order,
                         done_sections=[uuid.UUID(k) for k in done.get(t.id, {})], completed_on=done.get(t.id, {})) for t in topics])


async def _check_topic_rights(db: AsyncSession, user: User, class_id: uuid.UUID, subject_id: uuid.UUID) -> None:
    if not await _may_edit_topics(db, user, await _scope(db, user), class_id, subject_id):
        raise Forbidden("You can only edit the syllabus for subjects you teach in this class", code="NOT_YOUR_CLASS")


async def _next_order(db: AsyncSession, class_id: uuid.UUID, subject_id: uuid.UUID) -> int:
    return (await db.scalar(select(func.max(SyllabusTopic.sort_order)).where(
        SyllabusTopic.class_id == class_id, SyllabusTopic.subject_id == subject_id)) or 0) + 1


async def add_topic(db: AsyncSession, user: User, data: TopicIn) -> SyllabusTopic:
    await get_class(db, user.school_id, data.class_id)
    await _subject(db, user.school_id, data.subject_id)
    await _check_topic_rights(db, user, data.class_id, data.subject_id)
    t = SyllabusTopic(school_id=user.school_id, class_id=data.class_id, subject_id=data.subject_id, unit=data.unit or None,
                      title=data.title, planned_month=data.planned_month, sort_order=await _next_order(db, data.class_id, data.subject_id))
    db.add(t)
    await db.flush()
    return t


async def add_bulk(db: AsyncSession, user: User, data: TopicsBulk) -> int:
    await get_class(db, user.school_id, data.class_id)
    await _subject(db, user.school_id, data.subject_id)
    await _check_topic_rights(db, user, data.class_id, data.subject_id)
    lines = data.lines()
    if not lines:
        raise field_error("text", "Write one topic per line")
    if len(lines) > 300:
        raise field_error("text", "Add at most 300 topics at a time")
    order = await _next_order(db, data.class_id, data.subject_id)
    for i, (unit, title) in enumerate(lines):
        db.add(SyllabusTopic(school_id=user.school_id, class_id=data.class_id, subject_id=data.subject_id, unit=unit or None,
                             title=title, sort_order=order + i))
    await db.flush()
    await audit_service.record(db, "syllabus.import", school_id=user.school_id, user_id=user.id, entity_type="class",
                               entity_id=data.class_id, meta={"topics": len(lines)})
    return len(lines)


async def update_topic(db: AsyncSession, user: User, topic_id: uuid.UUID, data: TopicUpdate) -> None:
    t = await _topic(db, user.school_id, topic_id)
    await _check_topic_rights(db, user, t.class_id, t.subject_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None or k in ("unit", "planned_month"):
            setattr(t, k, v)


async def delete_topic(db: AsyncSession, user: User, topic_id: uuid.UUID) -> None:
    t = await _topic(db, user.school_id, topic_id)
    await _check_topic_rights(db, user, t.class_id, t.subject_id)
    await db.delete(t)


async def set_progress(db: AsyncSession, user: User, data: ProgressSet) -> None:
    t = await _topic(db, user.school_id, data.topic_id)
    section = await get_section(db, user.school_id, data.section_id)
    if section.class_id != t.class_id:
        raise field_error("section_id", "This section isn't in the topic's class")
    if not _allowed(await _scope(db, user), section.id, t.subject_id):
        raise Forbidden("You can only update classes you teach", code="NOT_YOUR_CLASS")
    row = await db.scalar(select(TopicProgress).where(TopicProgress.topic_id == t.id, TopicProgress.section_id == section.id))
    if not data.done:
        if row:
            await db.delete(row)
        return
    today = await school_today(db, user.school_id)
    when = data.completed_on or today
    if when > today:
        raise field_error("completed_on", "That date is in the future")
    if row:
        row.completed_on, row.completed_by = when, user.id
    else:
        db.add(TopicProgress(school_id=user.school_id, topic_id=t.id, section_id=section.id, completed_on=when, completed_by=user.id))
    await db.flush()


# ---- coverage ---------------------------------------------------------------------------------

async def _coverage(db: AsyncSession, school_id: uuid.UUID, pairs: set[tuple[uuid.UUID, uuid.UUID]]) -> list[CoverageRow]:
    """Coverage for (section, subject) pairs that have a syllabus."""
    if not pairs:
        return []
    labels = await _labels(db, school_id)
    sections = {s.id: s for s in (await db.scalars(select(Section).where(Section.id.in_({p[0] for p in pairs})))).all()}
    subjects = {s.id: s for s in (await db.scalars(select(Subject).where(Subject.school_id == school_id))).all()}
    class_ids = {s.class_id for s in sections.values()}
    topics = (await db.scalars(select(SyllabusTopic).where(SyllabusTopic.class_id.in_(class_ids))
                               .order_by(SyllabusTopic.sort_order))).all()
    by_cs: dict[tuple, list[SyllabusTopic]] = {}
    for t in topics:
        by_cs.setdefault((t.class_id, t.subject_id), []).append(t)
    progress: dict[tuple, date] = {(p.topic_id, p.section_id): p.completed_on for p in (await db.scalars(
        select(TopicProgress).where(TopicProgress.section_id.in_(list(sections))))).all()}
    this_month = (await school_today(db, school_id)).strftime("%Y-%m")
    out = []
    for sec_id, subj_id in pairs:
        sec = sections.get(sec_id)
        ts = by_cs.get((sec.class_id, subj_id), []) if sec else []
        if not ts or subj_id not in subjects:
            continue
        done = [t for t in ts if (t.id, sec_id) in progress]
        last = max(done, key=lambda t: progress[(t.id, sec_id)], default=None)
        behind = sum(1 for t in ts if t.planned_month and t.planned_month < this_month and (t.id, sec_id) not in progress)
        out.append(CoverageRow(section_id=sec_id, section_label=labels.get(sec_id, ("", 0))[0], class_id=sec.class_id,
                               subject_id=subj_id, subject_name=subjects[subj_id].name, subject_color=subjects[subj_id].color,
                               total=len(ts), done=len(done), percent=round(len(done) * 100 / len(ts), 1), behind=behind,
                               last_topic=last.title if last else None))
    order = {sid: o for sid, (_, o) in labels.items()}
    out.sort(key=lambda r: (order.get(r.section_id, 0), r.section_label, r.subject_name))
    return out


async def coverage(db: AsyncSession, user: User) -> list[CoverageRow]:
    """Staff: every section and subject they can see that has a syllabus."""
    scope = await _scope(db, user)
    from app.models import TimetableEntry
    rows = (await db.execute(select(TimetableEntry.section_id, TimetableEntry.subject_id)
                             .where(TimetableEntry.school_id == user.school_id).distinct())).all()
    pairs = {(sec, subj) for sec, subj in rows if _allowed(scope, sec, subj)}
    if scope is None:  # admins also see subjects with a syllabus but no timetable yet
        for cid, subj in (await db.execute(select(SyllabusTopic.class_id, SyllabusTopic.subject_id)
                                           .where(SyllabusTopic.school_id == user.school_id).distinct())).all():
            for s in await _class_sections(db, cid):
                pairs.add((s.id, subj))
    return await _coverage(db, user.school_id, pairs)


async def family_coverage(db: AsyncSession, user: User) -> list[ChildSyllabus]:
    out = []
    for kid in await own_students(db, user):
        subj_ids = (await db.scalars(select(SyllabusTopic.subject_id).where(SyllabusTopic.class_id == kid.class_id).distinct())).all()
        rows = await _coverage(db, user.school_id, {(kid.section_id, s) for s in subj_ids})
        out.append(ChildSyllabus(student_id=kid.id, name=f"{kid.first_name} {kid.last_name}", class_section=await student_label(db, kid),
                                 subjects=rows))
    return out


async def subjects_for_class(db: AsyncSession, user: User, class_id: uuid.UUID) -> list[dict]:
    """Subjects this user may open the syllabus for in a class (taught there, or with a syllabus already)."""
    from app.models import TimetableEntry
    await get_class(db, user.school_id, class_id)
    scope = await _scope(db, user)
    sections = [s.id for s in await _class_sections(db, class_id)]
    taught = set((await db.scalars(select(TimetableEntry.subject_id).where(TimetableEntry.section_id.in_(sections)).distinct())).all())
    has = set((await db.scalars(select(SyllabusTopic.subject_id).where(SyllabusTopic.class_id == class_id).distinct())).all())
    subjects = (await db.scalars(select(Subject).where(Subject.school_id == user.school_id).order_by(Subject.name))).all()
    candidates = (taught | has) or {s.id for s in subjects}
    out = []
    for s in subjects:
        if s.id not in candidates:
            continue
        if scope is not None and not any(_allowed(scope, sec, s.id) for sec in sections):
            continue
        out.append({"id": str(s.id), "name": s.name, "color": s.color, "topics": 0})
    counts = dict((await db.execute(select(SyllabusTopic.subject_id, func.count()).where(SyllabusTopic.class_id == class_id)
                                    .group_by(SyllabusTopic.subject_id))).all())
    for o in out:
        o["topics"] = counts.get(uuid.UUID(o["id"]), 0)
    return out


# ---- lesson plans -----------------------------------------------------------------------------

async def _lesson_out(db: AsyncSession, user: User, rows: list[LessonPlan], scope) -> list[LessonOut]:
    labels = await _labels(db, user.school_id)
    subjects = {s.id: s for s in (await db.scalars(select(Subject).where(Subject.school_id == user.school_id))).all()}
    topics = {t.id: t.title for t in (await db.scalars(select(SyllabusTopic).where(
        SyllabusTopic.id.in_([r.topic_id for r in rows if r.topic_id])))).all()}
    teachers = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_({r.teacher_id for r in rows if r.teacher_id})))).all())
    return [LessonOut(id=r.id, section_id=r.section_id, section_label=labels.get(r.section_id, ("", 0))[0], subject_id=r.subject_id,
                      subject_name=subjects[r.subject_id].name if r.subject_id in subjects else "",
                      subject_color=subjects[r.subject_id].color if r.subject_id in subjects else "blue",
                      topic_id=r.topic_id, topic_title=topics.get(r.topic_id), date=r.date, title=r.title, objectives=r.objectives,
                      activities=r.activities, resources=r.resources, status=r.status, teacher=teachers.get(r.teacher_id),
                      can_edit=scope is None or r.teacher_id == user.id) for r in rows]


async def list_lessons(db: AsyncSession, user: User, start: date, end: date, section_id: uuid.UUID | None,
                       teacher_id: uuid.UUID | None = None) -> list[LessonOut]:
    if (end - start).days > 62:
        raise field_error("to", "Choose at most two months")
    scope = await _scope(db, user)
    q = select(LessonPlan).where(LessonPlan.school_id == user.school_id, LessonPlan.date >= start, LessonPlan.date <= end)
    if section_id:
        q = q.where(LessonPlan.section_id == section_id)
    if scope is not None:  # teachers: their own plans and plans for sections they teach
        q = q.where((LessonPlan.teacher_id == user.id) | LessonPlan.section_id.in_(list(scope)))
    elif teacher_id:
        q = q.where(LessonPlan.teacher_id == teacher_id)
    rows = list((await db.scalars(q.order_by(LessonPlan.date, LessonPlan.created_at))).all())
    return await _lesson_out(db, user, rows, scope)


async def _check_lesson(db: AsyncSession, user: User, section_id: uuid.UUID, subject_id: uuid.UUID, topic_id: uuid.UUID | None) -> None:
    section = await get_section(db, user.school_id, section_id)
    await _subject(db, user.school_id, subject_id)
    if not _allowed(await _scope(db, user), section_id, subject_id):
        raise Forbidden("You can only plan lessons for classes and subjects you teach", code="NOT_YOUR_CLASS")
    if topic_id:
        t = await _topic(db, user.school_id, topic_id)
        if t.class_id != section.class_id or t.subject_id != subject_id:
            raise field_error("topic_id", "Choose a topic from this class's syllabus for the subject")


async def create_lesson(db: AsyncSession, user: User, data: LessonIn) -> LessonOut:
    await _check_lesson(db, user, data.section_id, data.subject_id, data.topic_id)
    lp = LessonPlan(school_id=user.school_id, teacher_id=user.id, **data.model_dump())
    db.add(lp)
    await db.flush()
    return (await _lesson_out(db, user, [lp], await _scope(db, user)))[0]


async def _lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonPlan:
    lp = await db.scalar(select(LessonPlan).where(LessonPlan.id == lesson_id, LessonPlan.school_id == user.school_id))
    if not lp:
        raise NotFound("Lesson plan not found")
    if await _scope(db, user) is not None and lp.teacher_id != user.id:
        raise Forbidden("You can only change your own lesson plans", code="NOT_YOUR_LESSON")
    return lp


async def update_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID, data: LessonUpdate) -> LessonOut:
    lp = await _lesson(db, user, lesson_id)
    changes = data.model_dump(exclude_unset=True)
    if "topic_id" in changes:
        await _check_lesson(db, user, lp.section_id, lp.subject_id, changes["topic_id"])
    for k, v in changes.items():
        if v is not None or k in ("topic_id", "objectives", "activities", "resources"):
            setattr(lp, k, v)
    await db.flush()
    return (await _lesson_out(db, user, [lp], await _scope(db, user)))[0]


async def delete_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> None:
    await db.delete(await _lesson(db, user, lesson_id))


async def mark_taught(db: AsyncSession, user: User, lesson_id: uuid.UUID, taught: bool) -> LessonOut:
    """Taught lessons tick their syllabus topic off for the section."""
    lp = await _lesson(db, user, lesson_id)
    lp.status = "taught" if taught else "planned"
    if lp.topic_id and taught:
        today = await school_today(db, user.school_id)
        await set_progress(db, user, ProgressSet(topic_id=lp.topic_id, section_id=lp.section_id, done=True,
                                                 completed_on=min(lp.date, today)))
    await db.flush()
    return (await _lesson_out(db, user, [lp], await _scope(db, user)))[0]


async def class_ids_for(db: AsyncSession, user: User) -> list[uuid.UUID]:
    scope = await _scope(db, user)
    q = select(SchoolClass.id).where(SchoolClass.school_id == user.school_id)
    if scope is not None:
        q = q.join(Section, Section.class_id == SchoolClass.id).where(Section.id.in_(list(scope))).distinct()
    return list((await db.scalars(q)).all())

