"""Admission enquiries: a small pipeline from first contact to admission."""
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.permissions import STAFF_ROLES
from app.models import Enquiry, School, SchoolClass, Student, User
from app.schemas.academics_extra import EnquiryIn, EnquiryOut, EnquirySummary, EnquiryUpdate, PublicEnquiry
from app.schemas.common import PageMeta, PageParams
from app.services import audit_service, notification_service
from app.services.academics_service import field_error
from app.services.family_service import school_today

STATUSES = ["new", "contacted", "visit", "applied", "admitted", "lost"]
OPEN = ("new", "contacted", "visit", "applied")


def _note(user: User | None, text: str) -> dict:
    return {"at": datetime.now(UTC).isoformat(), "by": user.full_name if user else "Website", "text": text}


async def _out(db: AsyncSession, rows: list[Enquiry], today) -> list[EnquiryOut]:
    classes = dict((await db.execute(select(SchoolClass.id, SchoolClass.name).where(
        SchoolClass.id.in_({e.class_id for e in rows if e.class_id})))).all())
    names = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_({e.assigned_to for e in rows if e.assigned_to})))).all())
    return [EnquiryOut(id=e.id, student_name=e.student_name, date_of_birth=e.date_of_birth, gender=e.gender, class_id=e.class_id,
                       class_name=classes.get(e.class_id), parent_name=e.parent_name, phone=e.phone, email=e.email,
                       previous_school=e.previous_school, source=e.source, status=e.status, follow_up_on=e.follow_up_on,
                       assigned_to=e.assigned_to, assigned_name=names.get(e.assigned_to), notes=list(reversed(e.notes or [])),
                       student_id=e.student_id, created_at=e.created_at,
                       overdue=bool(e.follow_up_on and e.follow_up_on < today and e.status in OPEN)) for e in rows]


async def _check_refs(db: AsyncSession, school_id: uuid.UUID, class_id=None, assigned_to=None, student_id=None) -> None:
    if class_id and not await db.scalar(select(SchoolClass.id).where(SchoolClass.id == class_id, SchoolClass.school_id == school_id)):
        raise field_error("class_id", "Choose a class from your school")
    if assigned_to and not await db.scalar(select(User.id).where(User.id == assigned_to, User.school_id == school_id,
                                                                 User.role.in_(STAFF_ROLES), User.is_active.is_(True))):
        raise field_error("assigned_to", "Choose an active staff member")
    if student_id and not await db.scalar(select(Student.id).where(Student.id == student_id, Student.school_id == school_id)):
        raise field_error("student_id", "Student not found")


async def create(db: AsyncSession, user: User, data: EnquiryIn) -> EnquiryOut:
    await _check_refs(db, user.school_id, class_id=data.class_id)
    e = Enquiry(school_id=user.school_id, **data.model_dump(exclude={"note"}), assigned_to=user.id,
                notes=[_note(user, data.note)] if data.note else [])
    db.add(e)
    await db.flush()
    await db.refresh(e)
    return (await _out(db, [e], await school_today(db, user.school_id)))[0]


async def create_public(db: AsyncSession, slug: str, data: PublicEnquiry) -> None:
    """From the school's public website. Tells the office through the notification centre."""
    from app.core.database import elevated
    async with elevated(db):
        school = await db.scalar(select(School).where(School.slug == slug, School.is_active.is_(True)))
        if not school:
            raise NotFound("School not found")
        if data.website:  # honeypot filled: quietly accept and drop
            return
        class_id = None
        if data.class_name:
            class_id = await db.scalar(select(SchoolClass.id).where(SchoolClass.school_id == school.id,
                                                                     func.lower(SchoolClass.name) == data.class_name.lower()))
        notes = [_note(None, data.message)] if data.message else []
        if data.class_name and not class_id:
            notes.append(_note(None, f"Class asked for: {data.class_name}"))
        e = Enquiry(school_id=school.id, student_name=data.student_name, class_id=class_id, parent_name=data.parent_name,
                    phone=data.phone, email=data.email, source="website", notes=notes)
        db.add(e)
        office = (await db.scalars(select(User.id).where(User.school_id == school.id, User.is_active.is_(True),
                                                         User.role.in_(["school_admin", "receptionist"])))).all()
        await notification_service.notify(db, office, school_id=school.id, kind="enquiry", title=f"New admission enquiry: {data.student_name}",
                                          body=f"{data.parent_name} · {data.phone}", link="/admissions")
        await db.flush()


async def list_enquiries(db: AsyncSession, user: User, page: PageParams, *, status: str | None, search: str | None,
                         due: bool = False) -> tuple[list[EnquiryOut], PageMeta]:
    today = await school_today(db, user.school_id)
    q = select(Enquiry).where(Enquiry.school_id == user.school_id)
    if status == "open":
        q = q.where(Enquiry.status.in_(OPEN))
    elif status:
        q = q.where(Enquiry.status == status)
    if due:
        q = q.where(Enquiry.status.in_(OPEN), Enquiry.follow_up_on <= today)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(or_(Enquiry.student_name.ilike(like), Enquiry.parent_name.ilike(like), Enquiry.phone.ilike(like)))
    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = (await db.scalars(q.order_by(Enquiry.follow_up_on.asc().nulls_last() if due else Enquiry.created_at.desc())
                             .offset(page.offset).limit(page.page_size))).all()
    return await _out(db, list(rows), today), PageMeta(total=total, page=page.page, page_size=page.page_size)


async def _get(db: AsyncSession, user: User, enquiry_id: uuid.UUID) -> Enquiry:
    e = await db.scalar(select(Enquiry).where(Enquiry.id == enquiry_id, Enquiry.school_id == user.school_id))
    if not e:
        raise NotFound("Enquiry not found")
    return e


async def get(db: AsyncSession, user: User, enquiry_id: uuid.UUID) -> EnquiryOut:
    return (await _out(db, [await _get(db, user, enquiry_id)], await school_today(db, user.school_id)))[0]


async def update(db: AsyncSession, user: User, enquiry_id: uuid.UUID, data: EnquiryUpdate) -> EnquiryOut:
    e = await _get(db, user, enquiry_id)
    changes = data.model_dump(exclude_unset=True)
    await _check_refs(db, user.school_id, class_id=changes.get("class_id"), assigned_to=changes.get("assigned_to"),
                      student_id=changes.get("student_id"))
    if changes.get("student_id"):
        changes.setdefault("status", "admitted")
    old_status = e.status
    for k, v in changes.items():
        if v is not None or k in ("follow_up_on", "assigned_to", "email", "date_of_birth", "previous_school", "class_id", "gender"):
            setattr(e, k, v)
    if e.status != old_status:
        e.notes = [*(e.notes or []), _note(user, f"Status: {old_status} → {e.status}")]
        if e.status in ("admitted", "lost"):
            e.follow_up_on = None
    await db.flush()
    await audit_service.record(db, "enquiry.update", school_id=user.school_id, user_id=user.id, entity_type="enquiry", entity_id=e.id,
                               meta={"status": e.status})
    return await get(db, user, e.id)


async def add_note(db: AsyncSession, user: User, enquiry_id: uuid.UUID, text: str) -> EnquiryOut:
    e = await _get(db, user, enquiry_id)
    e.notes = [*(e.notes or []), _note(user, text)]
    if e.status == "new":
        e.status = "contacted"
    await db.flush()
    return await get(db, user, e.id)


async def delete(db: AsyncSession, user: User, enquiry_id: uuid.UUID) -> None:
    await db.delete(await _get(db, user, enquiry_id))


async def summary(db: AsyncSession, user: User) -> EnquirySummary:
    today = await school_today(db, user.school_id)
    month_start = today.replace(day=1)
    by = dict((await db.execute(select(Enquiry.status, func.count()).where(Enquiry.school_id == user.school_id)
                                .group_by(Enquiry.status))).all())
    base = (Enquiry.school_id == user.school_id, Enquiry.status.in_(OPEN))
    due = await db.scalar(select(func.count()).where(*base, Enquiry.follow_up_on == today)) or 0
    overdue = await db.scalar(select(func.count()).where(*base, Enquiry.follow_up_on < today)) or 0
    start = datetime.combine(month_start, datetime.min.time(), tzinfo=UTC) - timedelta(hours=6)
    this_month = await db.scalar(select(func.count()).where(Enquiry.school_id == user.school_id, Enquiry.created_at >= start)) or 0
    admitted_month = await db.scalar(select(func.count()).where(Enquiry.school_id == user.school_id, Enquiry.status == "admitted",
                                                                 Enquiry.updated_at >= start)) or 0
    closed = by.get("admitted", 0) + by.get("lost", 0)
    return EnquirySummary(by_status={s: by.get(s, 0) for s in STATUSES}, due_today=due, overdue=overdue, this_month=this_month,
                          admitted_this_month=admitted_month,
                          conversion=round(by.get("admitted", 0) * 100 / closed, 1) if closed else None)
