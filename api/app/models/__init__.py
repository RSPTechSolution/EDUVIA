"""Import every model here so Alembic and the RLS coverage test see them."""
from app.models.academics import SchoolClass, Section, Student, StudentGuardian
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.billing import Lead, Plan
from app.models.school import School, SchoolModule
from app.models.user import PasswordResetToken, User, UserSession

__all__ = ["Base", "SchoolClass", "Section", "Student", "StudentGuardian", "Plan", "Lead", "School", "SchoolModule", "User", "UserSession", "PasswordResetToken", "AuditLog"]
