"""Roles, permissions and the module registry.

super_admin passes every permission check. Every other role must be listed.
"""
from enum import StrEnum


class Role(StrEnum):
    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    PRINCIPAL = "principal"
    TEACHER = "teacher"
    ACCOUNTANT = "accountant"
    RECEPTIONIST = "receptionist"
    LIBRARIAN = "librarian"
    HR_MANAGER = "hr_manager"
    TRANSPORT_MANAGER = "transport_manager"
    SECURITY_GUARD = "security_guard"
    STAFF = "staff"
    DRIVER = "driver"
    PARENT = "parent"
    STUDENT = "student"


SCHOOL_ROLES = [r for r in Role if r != Role.SUPER_ADMIN]
STAFF_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER, Role.ACCOUNTANT, Role.RECEPTIONIST,
               Role.LIBRARIAN, Role.HR_MANAGER, Role.TRANSPORT_MANAGER, Role.SECURITY_GUARD, Role.STAFF]
ADMINS = [Role.SCHOOL_ADMIN, Role.PRINCIPAL]

PERMISSIONS: dict[str, list[Role]] = {
    "school.view": SCHOOL_ROLES,
    "school.manage": [Role.SCHOOL_ADMIN],
    "modules.manage": [Role.SCHOOL_ADMIN],
    "users.view": ADMINS + [Role.HR_MANAGER],
    "users.manage": [Role.SCHOOL_ADMIN],
    "audit.view": ADMINS,
    "billing.view": ADMINS + [Role.ACCOUNTANT],
    "billing.manage": [Role.SCHOOL_ADMIN],
    "schools.manage": [],  # platform level: super_admin only
}


# Module registry. `default` modules are enabled for every new school.
MODULES: dict[str, dict] = {
    "students":      {"label": "Students", "default": True},
    "academics":     {"label": "Academics", "default": True},
    "attendance":    {"label": "Attendance", "default": True},
    "fees":          {"label": "Fee Management", "default": True},
    "accounts":      {"label": "Accounts", "default": False},
    "exams":         {"label": "Examinations", "default": True},
    "communication": {"label": "Communication", "default": True},
    "transport":     {"label": "Transport", "default": False},
    "hr":            {"label": "HR & Payroll", "default": True},
    "library":       {"label": "Library", "default": False},
    "hostel":        {"label": "Hostel", "default": False},
    "inventory":     {"label": "Inventory & Assets", "default": False},
    "security":      {"label": "Gate & Security", "default": False},
    "cctv":          {"label": "CCTV", "default": False},
    "ai":            {"label": "AI Assistant", "default": False},
    "analytics":     {"label": "Analytics", "default": True},
}


def has_permission(role: str, permission: str) -> bool:
    if role == Role.SUPER_ADMIN:
        return True
    return role in PERMISSIONS.get(permission, [])
