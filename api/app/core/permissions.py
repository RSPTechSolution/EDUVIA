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
    "emails.view": ADMINS,
    "emails.manage": [Role.SCHOOL_ADMIN],
    "billing.view": ADMINS + [Role.ACCOUNTANT],
    "students.view": ADMINS + [Role.TEACHER, Role.RECEPTIONIST, Role.ACCOUNTANT],
    "students.manage": ADMINS + [Role.RECEPTIONIST],
    "classes.manage": ADMINS,
    "timetable.view": ADMINS + [Role.TEACHER, Role.RECEPTIONIST],
    "timetable.manage": ADMINS,
    "attendance.view": ADMINS + [Role.TEACHER, Role.RECEPTIONIST],
    "attendance.mark": ADMINS + [Role.TEACHER],  # teachers: only sections they teach
    "attendance.manage": ADMINS,  # any section, any past date
    "attendance.scan": ADMINS + [Role.TEACHER, Role.RECEPTIONIST, Role.SECURITY_GUARD],  # QR scan at the gate or in class
    "leave.approve": ADMINS + [Role.TEACHER],  # teachers: their own class's students
    "calendar.manage": ADMINS + [Role.RECEPTIONIST],
    "devices.manage": [Role.SCHOOL_ADMIN],
    "fees.view": ADMINS + [Role.ACCOUNTANT, Role.RECEPTIONIST],
    "fees.collect": ADMINS + [Role.ACCOUNTANT, Role.RECEPTIONIST],
    "fees.manage": [Role.SCHOOL_ADMIN, Role.ACCOUNTANT],
    "accounts.view": ADMINS + [Role.ACCOUNTANT],
    "accounts.manage": [Role.SCHOOL_ADMIN, Role.ACCOUNTANT],
    "exams.view": ADMINS + [Role.TEACHER],
    "exams.marks": ADMINS + [Role.TEACHER],  # teachers: papers for sections they teach that subject in
    "exams.manage": ADMINS,  # create exams, date sheets, publish results
    "notices.post": ADMINS + [Role.TEACHER, Role.RECEPTIONIST],  # teachers: only to classes they teach
    "notices.manage": ADMINS + [Role.RECEPTIONIST],  # any audience, edit or remove any notice
    "homework.manage": ADMINS + [Role.TEACHER],
    "tests.manage": ADMINS + [Role.TEACHER],  # question bank and online tests, for subjects they teach
    "live.manage": ADMINS + [Role.TEACHER],
    "syllabus.manage": ADMINS + [Role.TEACHER],  # teachers: classes and subjects they teach
    "certificates.manage": ADMINS + [Role.RECEPTIONIST],
    "admissions.manage": ADMINS + [Role.RECEPTIONIST],
    "students.promote": ADMINS,
    "substitutions.manage": ADMINS,
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
