"""The class teacher's (incharge's) view of their class: today's attendance, students' attendance and fees,
pending leave and gate passes, and fee reminders to the class's parents."""
import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import enabled_modules
from app.core.errors import Forbidden, NotFound
from app.core.permissions import has_permission
from app.models import (
    AttendanceRecord, FeeInvoice, GatePass, LeaveRequest, SchoolClass, Section, Student, StudentGuardian, User,
)
from app.schemas.accounts import ReminderRequest, ReminderResult
from app.schemas.class_teacher import ClassStudent, MyClass, MyClassDetail
from app.services.academics_service import class_teacher_sections
from app.services.family_service import school_today

ZERO = Decimal(0)


async def _sections_for(db: AsyncSession, user: User) -> list[tuple[Section, str]]:
    """The incharge's own sections. Admins see every section here, so they can look at any class the same way."""
    q = select(Section, SchoolClass.name).join(SchoolClass, SchoolClass.id == Section.class_id).where(Section.school_id == user.school_id)
    if not has_permission(user.role, "attendance.manage"):
        q = q.where(Section.class_teacher_id == user.id)
    return [(s, f"{c} – {s.name}") for s, c in (await db.execute(q.order_by(SchoolClass.sort_order, Section.name))).all()]


async def _check(db: AsyncSession, user: User, section_id: uuid.UUID) -> tuple[Section, str]:
    row = (await db.execute(select(Section, SchoolClass.name).join(SchoolClass, SchoolClass.id == Section.class_id)
                            .where(Section.id == section_id, Section.school_id == user.school_id))).first()
    if not row:
        raise NotFound("Class not found")
    if not has_permission(user.role, "attendance.manage") and section_id not in await class_teacher_sections(db, user):
        raise Forbidden("Only the class teacher (incharge) of this class can do this", code="NOT_YOUR_SECTION")
    return row[0], f"{row[1]} – {row[0].name}"


def _pct(c: dict[str, int]) -> float | None:
    days = sum(c.values()) - c.get("leave", 0)
    return round(100 * (c.get("present", 0) + c.get("late", 0) + 0.5 * c.get("half_day", 0)) / days, 1) if days else None


async def my_classes(db: AsyncSession, user: User) -> list[MyClass]:
    rows = await _sections_for(db, user)
    if not rows:
        return []
    ids = [s.id for s, _ in rows]
    today = await school_today(db, user.school_id)
    fees_on = "fees" in await enabled_modules(db, user.school_id)
    students = dict((await db.execute(select(Student.section_id, func.count()).where(Student.section_id.in_(ids), Student.status == "active")
                                      .group_by(Student.section_id))).all())
    marks: dict[uuid.UUID, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for sid, status, n in (await db.execute(select(AttendanceRecord.section_id, AttendanceRecord.status, func.count())
                                            .where(AttendanceRecord.section_id.in_(ids), AttendanceRecord.date == today)
                                            .group_by(AttendanceRecord.section_id, AttendanceRecord.status))).all():
        marks[sid][status] = n
    leave = dict((await db.execute(select(Student.section_id, func.count()).select_from(LeaveRequest).join(Student, Student.id == LeaveRequest.student_id)
                                   .where(Student.section_id.in_(ids), LeaveRequest.status == "pending").group_by(Student.section_id))).all())
    passes = dict((await db.execute(select(Student.section_id, func.count()).select_from(GatePass).join(Student, Student.id == GatePass.student_id)
                                    .where(Student.section_id.in_(ids), GatePass.status == "pending").group_by(Student.section_id))).all())
    overdue: dict[uuid.UUID, tuple[int, Decimal]] = {}
    if fees_on:
        for sid, n, amt in (await db.execute(
                select(Student.section_id, func.count(func.distinct(FeeInvoice.student_id)),
                       func.coalesce(func.sum(FeeInvoice.total - FeeInvoice.discount - FeeInvoice.paid), 0))
                .select_from(FeeInvoice).join(Student, Student.id == FeeInvoice.student_id)
                .where(Student.section_id.in_(ids), Student.status == "active", FeeInvoice.status.in_(("unpaid", "partial")), FeeInvoice.due_date < today)
                .group_by(Student.section_id))).all():
            overdue[sid] = (n, Decimal(amt))
    out = []
    for s, label in rows:
        m = marks[s.id]
        out.append(MyClass(
            section_id=s.id, label=label, is_class_teacher=s.class_teacher_id == user.id, students=students.get(s.id, 0),
            attendance_marked=sum(m.values()) > 0, present=m.get("present", 0) + m.get("late", 0) + m.get("half_day", 0),
            absent=m.get("absent", 0), on_leave=m.get("leave", 0), pending_leave=leave.get(s.id, 0), pending_gate_passes=passes.get(s.id, 0),
            fees_enabled=fees_on, students_overdue=overdue.get(s.id, (0, ZERO))[0], overdue_amount=overdue.get(s.id, (0, ZERO))[1]))
    return out


async def class_detail(db: AsyncSession, user: User, section_id: uuid.UUID) -> MyClassDetail:
    section, label = await _check(db, user, section_id)
    today = await school_today(db, user.school_id)
    month_start = today.replace(day=1)
    fees_on = "fees" in await enabled_modules(db, user.school_id)
    students = list((await db.scalars(select(Student).where(Student.section_id == section.id, Student.status == "active")
                                      .order_by(Student.roll_no.nulls_last(), Student.first_name))).all())
    ids = [s.id for s in students]
    month: dict[uuid.UUID, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    today_status: dict[uuid.UUID, str] = {}
    for sid, status, d in (await db.execute(select(AttendanceRecord.student_id, AttendanceRecord.status, AttendanceRecord.date)
                                            .where(AttendanceRecord.student_id.in_(ids), AttendanceRecord.date.between(month_start, today)))).all():
        month[sid][status] += 1
        if d == today:
            today_status[sid] = status
    dues: dict[uuid.UUID, tuple[Decimal, bool]] = {}
    if fees_on:
        for sid, due, first_due in (await db.execute(
                select(FeeInvoice.student_id, func.sum(FeeInvoice.total - FeeInvoice.discount - FeeInvoice.paid), func.min(FeeInvoice.due_date))
                .where(FeeInvoice.student_id.in_(ids), FeeInvoice.status.in_(("unpaid", "partial"))).group_by(FeeInvoice.student_id))).all():
            dues[sid] = (Decimal(due), first_due < today)
    guardians: dict[uuid.UUID, list[str]] = defaultdict(list)
    for sid, name, phone, rel in (await db.execute(select(StudentGuardian.student_id, User.full_name, User.phone, StudentGuardian.relationship)
                                                   .join(User, User.id == StudentGuardian.user_id)
                                                   .where(StudentGuardian.student_id.in_(ids), User.is_active.is_(True)))).all():
        guardians[sid].append(f"{name} ({rel}){' · ' + phone if phone else ''}")
    teacher = await db.get(User, section.class_teacher_id) if section.class_teacher_id else None
    rows = [ClassStudent(
        student_id=s.id, name=f"{s.first_name} {s.last_name}", roll_no=s.roll_no, admission_no=s.admission_no, photo_file_id=s.photo_file_id,
        today=today_status.get(s.id), attendance_percent=_pct(month[s.id]), days_absent=month[s.id].get("absent", 0),
        fee_due=dues.get(s.id, (ZERO, False))[0], fee_overdue=dues.get(s.id, (ZERO, False))[1], guardians=guardians.get(s.id, []),
    ) for s in students]
    return MyClassDetail(section_id=section.id, label=label, class_teacher=teacher.full_name if teacher else None, fees_enabled=fees_on,
                         month_start=month_start, students=rows)


async def remind_fees(db: AsyncSession, user: User, section_id: uuid.UUID, overdue_only: bool) -> ReminderResult:
    from app.services.accounts_service import send_reminders
    section, _ = await _check(db, user, section_id)
    if "fees" not in await enabled_modules(db, user.school_id):
        raise Forbidden("Fees aren't switched on for your school", code="MODULE_DISABLED")
    return await send_reminders(db, user, ReminderRequest(overdue_only=overdue_only, section_id=section.id))

