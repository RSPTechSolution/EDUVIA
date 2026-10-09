"""Co-scholastic grades on report cards, and live (online) classes."""
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import has_permission
from app.models import CoScholasticArea, CoScholasticGrade, Exam, LiveClass, School, Section, Student, Subject, User
from app.schemas.online import AreaOut, CoSave, CoSheet, CoSheetRow, LiveIn, LiveOut
from app.services import notification_service
from app.services.academics_service import field_error, get_section
from app.services.family_service import own_students
from app.services.homework_service import _allowed, _labels, _scope

DEFAULT_AREAS = ["Work education", "Art education", "Health and physical education", "Discipline"]


# ---- co-scholastic ----------------------------------------------------------------------------

async def areas(db: AsyncSession, school_id: uuid.UUID) -> list[CoScholasticArea]:
    rows = list((await db.scalars(select(CoScholasticArea).where(CoScholasticArea.school_id == school_id)
                                  .order_by(CoScholasticArea.sort_order, CoScholasticArea.name))).all())
    if not rows:
        for i, n in enumerate(DEFAULT_AREAS):
            rows.append(CoScholasticArea(school_id=school_id, name=n, sort_order=i))
            db.add(rows[-1])
        await db.flush()
    return rows


async def add_area(db: AsyncSession, user: User, name: str) -> AreaOut:
    existing = await areas(db, user.school_id)
    if any(a.name.lower() == name.lower() for a in existing):
        raise field_error("name", "This area already exists")
    a = CoScholasticArea(school_id=user.school_id, name=name, sort_order=len(existing))
    db.add(a)
    await db.flush()
    return AreaOut(id=a.id, name=a.name, sort_order=a.sort_order)


async def delete_area(db: AsyncSession, user: User, area_id: uuid.UUID) -> None:
    a = await db.scalar(select(CoScholasticArea).where(CoScholasticArea.id == area_id, CoScholasticArea.school_id == user.school_id))
    if not a:
        raise NotFound("Area not found")
    await db.delete(a)


async def _may_grade(db: AsyncSession, user: User, section: Section) -> bool:
    return has_permission(user.role, "exams.manage") or section.class_teacher_id == user.id


async def sheet(db: AsyncSession, user: User, exam_id: uuid.UUID, section_id: uuid.UUID) -> CoSheet:
    exam = await db.scalar(select(Exam).where(Exam.id == exam_id, Exam.school_id == user.school_id))
    if not exam:
        raise NotFound("Exam not found")
    section = await get_section(db, user.school_id, section_id)
    editable = await _may_grade(db, user, section) and not exam.published_at
    if not has_permission(user.role, "exams.view"):
        raise Forbidden("Not allowed", code="PERMISSION_DENIED")
    ar = await areas(db, user.school_id)
    students = (await db.scalars(select(Student).where(Student.section_id == section.id, Student.status == "active")
                                 .order_by(Student.roll_no.nulls_last(), Student.first_name))).all()
    grades: dict[uuid.UUID, dict[str, str]] = {}
    for g in (await db.scalars(select(CoScholasticGrade).where(CoScholasticGrade.exam_id == exam.id,
                                                               CoScholasticGrade.student_id.in_([s.id for s in students])))).all():
        grades.setdefault(g.student_id, {})[str(g.area_id)] = g.grade
    labels = await _labels(db, user.school_id)
    return CoSheet(exam_id=exam.id, section_id=section.id, label=f"{exam.name} · {labels.get(section.id, ('', 0))[0]}",
                   areas=[AreaOut(id=a.id, name=a.name, sort_order=a.sort_order) for a in ar],
                   rows=[CoSheetRow(student_id=s.id, name=f"{s.first_name} {s.last_name}", roll_no=s.roll_no, grades=grades.get(s.id, {}))
                         for s in students], editable=editable)


async def save_sheet(db: AsyncSession, user: User, exam_id: uuid.UUID, section_id: uuid.UUID, data: CoSave) -> CoSheet:
    exam = await db.scalar(select(Exam).where(Exam.id == exam_id, Exam.school_id == user.school_id))
    if not exam:
        raise NotFound("Exam not found")
    section = await get_section(db, user.school_id, section_id)
    if not await _may_grade(db, user, section):
        raise Forbidden("Only the class teacher or the exam office can enter these grades", code="NOT_YOUR_CLASS")
    if exam.published_at:
        raise AppError("Results are published; unpublish to change grades", code="MARKS_LOCKED", status_code=409)
    area_ids = {a.id for a in await areas(db, user.school_id)}
    in_section = set((await db.scalars(select(Student.id).where(Student.section_id == section.id))).all())
    existing = {(g.student_id, g.area_id): g for g in (await db.scalars(select(CoScholasticGrade).where(
        CoScholasticGrade.exam_id == exam.id, CoScholasticGrade.student_id.in_(in_section)))).all()}
    for sid, row in data.grades.items():
        if sid not in in_section:
            raise field_error("grades", "A student isn't in this class")
        for aid, grade in row.items():
            if aid not in area_ids:
                raise field_error("grades", "Unknown area")
            g = existing.get((sid, aid))
            if grade is None:
                if g:
                    await db.delete(g)
            elif g:
                g.grade = grade
            else:
                db.add(CoScholasticGrade(school_id=user.school_id, exam_id=exam.id, student_id=sid, area_id=aid, grade=grade))
    await db.flush()
    return await sheet(db, user, exam_id, section_id)


async def for_report(db: AsyncSession, school_id: uuid.UUID, exam_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
    rows = (await db.execute(select(CoScholasticArea.name, CoScholasticGrade.grade).join(CoScholasticArea, CoScholasticArea.id == CoScholasticGrade.area_id)
                             .where(CoScholasticGrade.exam_id == exam_id, CoScholasticGrade.student_id == student_id)
                             .order_by(CoScholasticArea.sort_order))).all()
    return [{"area": a, "grade": g} for a, g in rows]


# ---- live classes -----------------------------------------------------------------------------

def provider(url: str) -> str:
    u = url.lower()
    return ("Google Meet" if "meet.google." in u else "Zoom" if "zoom.us" in u else "Jitsi" if "jit.si" in u
            else "Microsoft Teams" if "teams.microsoft" in u else "Link")


def _state(lc: LiveClass, now: datetime) -> str:
    if lc.cancelled:
        return "cancelled"
    end = lc.starts_at + timedelta(minutes=lc.duration_minutes)
    return "upcoming" if now < lc.starts_at - timedelta(minutes=10) else "live" if now <= end else "ended"


async def _live_out(db: AsyncSession, user: User, rows: list[LiveClass]) -> list[LiveOut]:
    labels = await _labels(db, user.school_id)
    subjects = {s.id: s for s in (await db.scalars(select(Subject).where(Subject.school_id == user.school_id))).all()}
    teachers = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_({r.teacher_id for r in rows if r.teacher_id})))).all())
    scope = await _scope(db, user) if user.role not in ("parent", "student") else {}
    now = datetime.now(UTC)
    return [LiveOut(id=r.id, title=r.title, section_ids=r.section_ids, sections_label=", ".join(labels.get(s, ("", 0))[0] for s in r.section_ids),
                    subject_name=subjects[r.subject_id].name if r.subject_id in subjects else None,
                    subject_color=subjects[r.subject_id].color if r.subject_id in subjects else None, starts_at=r.starts_at,
                    ends_at=r.starts_at + timedelta(minutes=r.duration_minutes), duration_minutes=r.duration_minutes, meeting_url=r.meeting_url,
                    provider=provider(r.meeting_url), notes=r.notes, teacher=teachers.get(r.teacher_id), cancelled=r.cancelled,
                    state=_state(r, now), can_edit=scope is None or r.teacher_id == user.id) for r in rows]


async def list_live(db: AsyncSession, user: User, days_back: int = 7) -> list[LiveOut]:
    since = datetime.now(UTC) - timedelta(days=days_back)
    q = select(LiveClass).where(LiveClass.school_id == user.school_id, LiveClass.starts_at >= since)
    if user.role in ("parent", "student"):
        sections = [k.section_id for k in await own_students(db, user)]
        if not sections:
            return []
        q = q.where(LiveClass.section_ids.overlap(sections))
    else:
        scope = await _scope(db, user)
        if scope is not None:
            q = q.where((LiveClass.teacher_id == user.id) | LiveClass.section_ids.overlap(list(scope) or [uuid.uuid4()]))
    rows = list((await db.scalars(q.order_by(LiveClass.starts_at))).all())
    return await _live_out(db, user, rows)


async def _check_live(db: AsyncSession, user: User, data: LiveIn) -> None:
    scope = await _scope(db, user)
    labels = await _labels(db, user.school_id)
    for i, sid in enumerate(data.section_ids):
        if sid not in labels:
            raise field_error(f"section_ids.{i}", "Choose classes from your school")
        if not _allowed(scope, sid, data.subject_id):
            raise Forbidden("You can only schedule live classes for classes you teach", code="NOT_YOUR_CLASS")
    if data.subject_id and not await db.scalar(select(Subject.id).where(Subject.id == data.subject_id, Subject.school_id == user.school_id)):
        raise field_error("subject_id", "Choose a subject from your school")


async def create_live(db: AsyncSession, user: User, data: LiveIn) -> LiveOut:
    await _check_live(db, user, data)
    if data.starts_at < datetime.now(UTC) - timedelta(minutes=5):
        raise field_error("starts_at", "The start time has passed")
    url = data.meeting_url
    if not url:  # a free Jitsi room nobody can guess
        slug = await db.scalar(select(School.slug).where(School.id == user.school_id))
        url = f"https://meet.jit.si/vidyanexa-{slug}-{secrets.token_urlsafe(9).replace('_', '').replace('-', '')}"
    lc = LiveClass(school_id=user.school_id, teacher_id=user.id, **{**data.model_dump(), "meeting_url": url})
    db.add(lc)
    await db.flush()
    await db.refresh(lc)
    await notification_service.notify(
        db, await notification_service.family_of_sections(db, data.section_ids), school_id=user.school_id, kind="live_class",
        title=f"Live class: {lc.title}", body=f"{lc.starts_at:%d %b, %H:%M} UTC · {lc.duration_minutes} min", link="/live-classes",
        data={"live_id": lc.id})
    return (await _live_out(db, user, [lc]))[0]


async def _live(db: AsyncSession, user: User, live_id: uuid.UUID) -> LiveClass:
    lc = await db.scalar(select(LiveClass).where(LiveClass.id == live_id, LiveClass.school_id == user.school_id))
    if not lc:
        raise NotFound("Live class not found")
    if await _scope(db, user) is not None and lc.teacher_id != user.id:
        raise Forbidden("You can only change live classes you scheduled", code="NOT_YOURS")
    return lc


async def update_live(db: AsyncSession, user: User, live_id: uuid.UUID, data: LiveIn) -> LiveOut:
    lc = await _live(db, user, live_id)
    await _check_live(db, user, data)
    for k, v in data.model_dump().items():
        if k == "meeting_url" and not v:
            continue
        setattr(lc, k, v)
    await db.flush()
    return (await _live_out(db, user, [lc]))[0]


async def cancel_live(db: AsyncSession, user: User, live_id: uuid.UUID) -> LiveOut:
    lc = await _live(db, user, live_id)
    if not lc.cancelled:
        lc.cancelled = True
        await notification_service.notify(
            db, await notification_service.family_of_sections(db, lc.section_ids), school_id=user.school_id, kind="live_class",
            title=f"Cancelled: {lc.title}", body=f"The live class on {lc.starts_at:%d %b, %H:%M} UTC won't take place.", link="/live-classes")
    await db.flush()
    return (await _live_out(db, user, [lc]))[0]



