"""Year-end promotion: move a section's students to the next class, keep some back, or mark them as left.

Students in the last class graduate (become alumni). Suggestions come from the latest published exam.
"""
import uuid
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict
from app.models import Exam, ExamPaper, SchoolClass, Section, Student, User
from app.schemas.academics_extra import PromotionPreview, PromotionRequest, PromotionResult, PromotionStudent
from app.services import audit_service
from app.services.academics_service import field_error, get_class, get_section
from app.services.exam_service import _section_results


async def _next_class(db: AsyncSession, school_id: uuid.UUID, c: SchoolClass) -> SchoolClass | None:
    return await db.scalar(select(SchoolClass).where(SchoolClass.school_id == school_id, SchoolClass.sort_order > c.sort_order)
                           .order_by(SchoolClass.sort_order, SchoolClass.name).limit(1))


async def _sizes(db: AsyncSession, section_ids) -> dict[uuid.UUID, int]:
    return dict((await db.execute(select(Student.section_id, func.count()).where(
        Student.section_id.in_(list(section_ids)), Student.status == "active").group_by(Student.section_id))).all())


async def preview(db: AsyncSession, user: User, section_id: uuid.UUID) -> PromotionPreview:
    section = await get_section(db, user.school_id, section_id)
    c = await get_class(db, user.school_id, section.class_id)
    nxt = await _next_class(db, user.school_id, c)
    next_sections = list((await db.scalars(select(Section).where(Section.class_id == nxt.id).order_by(Section.name))).all()) if nxt else []
    sizes = await _sizes(db, [s.id for s in next_sections])
    default = next((s.id for s in next_sections if s.name == section.name), next_sections[0].id if next_sections else None)

    students = list((await db.scalars(select(Student).where(Student.section_id == section.id, Student.status == "active")
                                      .order_by(Student.roll_no.nulls_last(), Student.first_name))).all())
    exam = await db.scalar(select(Exam).join(ExamPaper, ExamPaper.exam_id == Exam.id)
                           .where(Exam.school_id == user.school_id, Exam.published_at.is_not(None), ExamPaper.class_id == c.id)
                           .order_by(Exam.end_date.desc().nulls_last(), Exam.published_at.desc()).limit(1))
    results = {}
    if exam and students:
        rows, _ = await _section_results(db, user.school_id, exam, section, students)
        results = {r.student_id: r for r in rows}
    out = []
    for s in students:
        r = results.get(s.id)
        passed = r.passed if r and r.percent is not None else None
        suggested = "graduate" if not nxt else ("repeat" if passed is False else "promote")
        out.append(PromotionStudent(student_id=s.id, name=f"{s.first_name} {s.last_name}", admission_no=s.admission_no, roll_no=s.roll_no,
                                    exam=exam.name if exam and r and r.percent is not None else None,
                                    percent=r.percent if r else None, passed=passed, suggested=suggested))
    return PromotionPreview(section_id=section.id, section_label=f"{c.name} – {section.name}", next_class_id=nxt.id if nxt else None,
                            next_class_name=nxt.name if nxt else None,
                            next_sections=[{"id": str(s.id), "name": s.name, "students": sizes.get(s.id, 0), "capacity": s.capacity}
                                           for s in next_sections],
                            default_section_id=default, students=out)


async def promote(db: AsyncSession, user: User, data: PromotionRequest) -> PromotionResult:
    section = await get_section(db, user.school_id, data.section_id)
    c = await get_class(db, user.school_id, section.class_id)
    nxt = await _next_class(db, user.school_id, c)
    students = {s.id: s for s in (await db.scalars(select(Student).where(Student.section_id == section.id, Student.status == "active"))).all()}
    targets = {s.id: s for s in (await db.scalars(select(Section).where(Section.class_id == nxt.id))).all()} if nxt else {}

    seen = set()
    for i, item in enumerate(data.items):
        if item.student_id not in students:
            raise field_error(f"items.{i}.student_id", "This student isn't active in the section")
        if item.student_id in seen:
            raise field_error(f"items.{i}.student_id", "Listed twice")
        seen.add(item.student_id)
        if item.action == "promote":
            if not nxt:
                raise field_error(f"items.{i}.action", f"{c.name} is the last class: graduate the student instead")
            if item.to_section_id not in targets:
                raise field_error(f"items.{i}.to_section_id", f"Choose a section of {nxt.name}")
        if item.action == "graduate" and nxt:
            raise field_error(f"items.{i}.action", f"Only students of the last class graduate; promote to {nxt.name}")

    # Capacity of the sections students are moving into.
    incoming = Counter(it.to_section_id for it in data.items if it.action == "promote")
    sizes = await _sizes(db, incoming)
    for sid, n in incoming.items():
        cap = targets[sid].capacity
        if cap and sizes.get(sid, 0) + n > cap:
            raise Conflict(f"{nxt.name} – {targets[sid].name} has room for {cap - sizes.get(sid, 0)} more "
                           f"(capacity {cap}). Promote the older class first, or choose another section.", code="SECTION_FULL")

    counts = Counter()
    moved: dict[uuid.UUID, list[Student]] = {}
    for item in data.items:
        s = students[item.student_id]
        if item.action == "promote":
            s.class_id, s.section_id = nxt.id, item.to_section_id
            moved.setdefault(item.to_section_id, []).append(s)
        elif item.action == "leave":
            s.status = "inactive"
        elif item.action == "graduate":
            s.status = "alumni"
        counts[item.action] += 1
    if data.reset_roll_numbers:
        for s in students.values():
            if s.status == "active":
                s.roll_no = None  # cleared first so renumbering never collides
        await db.flush()
        for sid in {*moved, section.id}:
            rows = (await db.scalars(select(Student).where(Student.section_id == sid, Student.status == "active")
                                     .order_by(Student.roll_no.nulls_last(), Student.first_name, Student.last_name))).all()
            taken = {r.roll_no for r in rows if r.roll_no}
            n = 0
            for r in rows:
                if r.roll_no is None:
                    n += 1
                    while n in taken:
                        n += 1
                    r.roll_no = n
    await db.flush()
    result = PromotionResult(promoted=counts["promote"], repeated=counts["repeat"], left=counts["leave"], graduated=counts["graduate"])
    await audit_service.record(db, "students.promote", school_id=user.school_id, user_id=user.id, entity_type="section",
                               entity_id=section.id, meta={"from": f"{c.name} – {section.name}", "to": nxt.name if nxt else None,
                                                           **result.model_dump()})
    return result
