"""Which students a parent or student account may see."""
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.permissions import Role, has_permission
from app.models import School, SchoolClass, Section, Student, StudentGuardian, User


async def school_today(db: AsyncSession, school_id: uuid.UUID) -> date:
    """Today's date where the school is, not where the server is."""
    tz = await db.scalar(select(School.timezone).where(School.id == school_id))
    return datetime.now(ZoneInfo(tz or "Asia/Kolkata")).date()


async def own_students(db: AsyncSession, user: User) -> list[Student]:
    """A parent's active children, or a student's own record."""
    if user.role == Role.PARENT:
        stmt = (select(Student).join(StudentGuardian, StudentGuardian.student_id == Student.id)
                .where(StudentGuardian.user_id == user.id))
    elif user.role == Role.STUDENT:
        stmt = select(Student).where(Student.user_id == user.id)
    else:
        return []
    return list((await db.scalars(stmt.where(Student.status == "active").order_by(Student.first_name))).all())


async def student_label(db: AsyncSession, student: Student) -> str:
    row = (await db.execute(select(SchoolClass.name, Section.name).join(Section, Section.class_id == SchoolClass.id)
                            .where(Section.id == student.section_id))).first()
    return f"{row[0]} – {row[1]}" if row else ""


async def visible_student(db: AsyncSession, user: User, student_id: uuid.UUID, staff_permission: str) -> Student:
    """The student, if this user may see them: staff with the permission, the student, or their parent."""
    student = await db.scalar(select(Student).where(Student.id == student_id, Student.school_id == user.school_id))
    if student and has_permission(user.role, staff_permission):
        return student
    if student and student.id in {s.id for s in await own_students(db, user)}:
        return student
    raise NotFound("Student not found")
