"""Import every model here so Alembic and the RLS coverage test see them."""
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.school import School, SchoolModule
from app.models.user import PasswordResetToken, User, UserSession

__all__ = ["Base", "School", "SchoolModule", "User", "UserSession", "PasswordResetToken", "AuditLog"]
