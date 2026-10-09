"""Import every model here so Alembic and the RLS coverage test see them."""
from app.models.accounts import AccountEntry, LedgerHead
from app.models.attendance import AttendanceRecord
from app.models.attendance_extra import BiometricDevice, BiometricPunch, CalendarEvent, LeaveRequest, PeriodAttendance
from app.models.academics_extra import Certificate, Enquiry, LessonPlan, Substitution, SyllabusTopic, TopicProgress
from app.models.academics import SchoolClass, Section, Student, StudentGuardian
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.billing import Lead, Plan
from app.models.communication import Homework, HomeworkStatus, Notice, NoticeRead
from app.models.email import EmailLog
from app.models.messaging import ChatMessage, Conversation, MessageLog, PtmBooking, PtmEvent, Survey, SurveyResponse
from app.models.online import CoScholasticArea, CoScholasticGrade, LiveClass, OnlineTest, Question, TestAttempt
from app.models.platform import DeviceToken, Notification, StoredFile
from app.models.exams import Exam, ExamMark, ExamPaper, ExamRemark
from app.models.finance import FeeCategory, FeeInvoice, FeeInvoiceItem, FeePayment, FeeStructure, PaymentOrder
from app.models.school import School, SchoolModule
from app.models.timetable import Period, Subject, TeacherSubject, TeacherUnavailability, TimetableEntry
from app.models.transport import Boarding, Route, SosAlert, Stop, TransportAssignment, Trip, TripPing, Vehicle
from app.models.user import PasswordResetToken, User, UserSession

__all__ = ["Base", "SchoolClass", "Section", "Student", "StudentGuardian", "Plan", "Lead", "School", "SchoolModule", "User", "UserSession", "PasswordResetToken", "AuditLog",
           "Subject", "Period", "TeacherSubject", "TeacherUnavailability", "TimetableEntry",
           "AttendanceRecord", "FeeCategory", "FeeStructure", "FeeInvoice", "FeeInvoiceItem", "FeePayment", "PaymentOrder",
           "Exam", "ExamPaper", "ExamMark", "ExamRemark", "Notice", "NoticeRead", "Homework", "HomeworkStatus", "EmailLog",
           "StoredFile", "Notification", "DeviceToken",
           "SyllabusTopic", "TopicProgress", "LessonPlan", "Certificate", "Enquiry", "Substitution",
           "CalendarEvent", "LeaveRequest", "BiometricDevice", "BiometricPunch", "PeriodAttendance",
           "LedgerHead", "AccountEntry",
           "Question", "OnlineTest", "TestAttempt", "CoScholasticArea", "CoScholasticGrade", "LiveClass",
           "MessageLog", "Conversation", "ChatMessage", "PtmEvent", "PtmBooking", "Survey", "SurveyResponse",
           "Vehicle", "Route", "Stop", "TransportAssignment", "Trip", "TripPing", "Boarding", "SosAlert"]
