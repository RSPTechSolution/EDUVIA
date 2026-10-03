"""Import every model here so Alembic and the RLS coverage test see them."""
from app.models.attendance import AttendanceRecord
from app.models.academics import SchoolClass, Section, Student, StudentGuardian
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.billing import Lead, Plan
from app.models.communication import Homework, HomeworkStatus, Notice, NoticeRead
from app.models.exams import Exam, ExamMark, ExamPaper, ExamRemark
from app.models.finance import FeeCategory, FeeInvoice, FeeInvoiceItem, FeePayment, FeeStructure, PaymentOrder
from app.models.school import School, SchoolModule
from app.models.timetable import Period, Subject, TeacherSubject, TeacherUnavailability, TimetableEntry
from app.models.user import PasswordResetToken, User, UserSession

__all__ = ["Base", "SchoolClass", "Section", "Student", "StudentGuardian", "Plan", "Lead", "School", "SchoolModule", "User", "UserSession", "PasswordResetToken", "AuditLog",
           "Subject", "Period", "TeacherSubject", "TeacherUnavailability", "TimetableEntry",
           "AttendanceRecord", "FeeCategory", "FeeStructure", "FeeInvoice", "FeeInvoiceItem", "FeePayment", "PaymentOrder",
           "Exam", "ExamPaper", "ExamMark", "ExamRemark", "Notice", "NoticeRead", "Homework", "HomeworkStatus"]
