"""Which emails go out when something happens. Services call these; nothing here raises."""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import FeeInvoice, FeePayment, School, SchoolClass, Section, Student, StudentGuardian, User
from app.services import email_service, email_templates as t

log = logging.getLogger("eduvia.notify")

ROLE_LABELS = {
    "school_admin": "School admin", "principal": "Principal", "teacher": "Teacher", "accountant": "Accountant",
    "receptionist": "Receptionist", "librarian": "Librarian", "hr_manager": "HR manager",
    "transport_manager": "Transport manager", "security_guard": "Security guard", "staff": "Staff",
    "driver": "Driver", "parent": "Parent", "student": "Student",
}


async def _school(db: AsyncSession, school_id) -> School | None:
    return await db.get(School, school_id) if school_id else None


async def account_created(db: AsyncSession, user: User, password: str) -> None:
    """Welcome email with the school ID and temporary password."""
    school = await _school(db, user.school_id)
    if not school:
        return
    await email_service.queue(db, t.welcome(to=user.email, name=user.full_name, role_label=ROLE_LABELS.get(user.role, user.role),
                                            school_name=school.name, school_slug=school.slug, password=password),
                              school_id=school.id)


async def password_set(db: AsyncSession, user: User, password: str) -> None:
    school = await _school(db, user.school_id)
    if not school:
        return
    await email_service.queue(db, t.password_set_by_school(to=user.email, name=user.full_name, school_name=school.name,
                                                           school_slug=school.slug, password=password), school_id=school.id)


async def password_reset(db: AsyncSession, user: User, token: str) -> None:
    school = await _school(db, user.school_id)
    await email_service.queue(db, t.password_reset(to=user.email, name=user.full_name, school_name=school.name if school else None,
                                                   token=token, minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
                              school_id=user.school_id)


async def fee_paid(db: AsyncSession, payment: FeePayment, invoice: FeeInvoice) -> None:
    """Receipt to every parent of the student who has an email (and the student's own login)."""
    school = await _school(db, invoice.school_id)
    student = await db.get(Student, invoice.student_id)
    if not school or not student:
        return
    row = (await db.execute(select(SchoolClass.name, Section.name).join(Section, Section.class_id == SchoolClass.id)
                            .where(Section.id == student.section_id))).first()
    class_section = f"{row[0]} – {row[1]}" if row else ""
    recipients = (await db.execute(select(User.email, User.full_name).join(StudentGuardian, StudentGuardian.user_id == User.id)
                                   .where(StudentGuardian.student_id == student.id, User.is_active.is_(True)))).all()
    balance = max(invoice.total - invoice.discount - invoice.paid, 0)
    method = {"cash": "Cash", "upi": "UPI", "cheque": "Cheque", "card": "Card", "bank_transfer": "Bank transfer", "online": "Online"}.get(payment.method, payment.method)
    for email, name in recipients:
        await email_service.queue(db, t.fee_receipt(
            to=email, name=name, school_name=school.name, student=f"{student.first_name} {student.last_name}", class_section=class_section,
            term=invoice.term, receipt_no=payment.receipt_no, amount=payment.amount, method=method, paid_at=payment.paid_at,
            balance=balance, payment_id=str(payment.id)), school_id=school.id)
