"""What each kind of user must (and may) have. Served to the web app at
/api/v1/meta/roles so forms show exactly what the API enforces."""
from app.core.permissions import Role

# Field keys understood by user creation/update:
#   phone, employee_id, designation, license_no  -> columns on users
#   children   -> parent: at least one linked student (with relationship)
#   student_id -> student: link to an existing student record (which holds the class)
STAFF_FIELDS = {"required": ["phone"], "optional": ["employee_id", "designation"]}
LEADER_FIELDS = {"required": [], "optional": ["phone", "employee_id", "designation"]}

ROLE_RULES: dict[str, dict[str, list[str]]] = {
    Role.SCHOOL_ADMIN: LEADER_FIELDS,
    Role.PRINCIPAL: LEADER_FIELDS,
    Role.TEACHER: STAFF_FIELDS,
    Role.ACCOUNTANT: STAFF_FIELDS,
    Role.RECEPTIONIST: STAFF_FIELDS,
    Role.LIBRARIAN: STAFF_FIELDS,
    Role.HR_MANAGER: STAFF_FIELDS,
    Role.TRANSPORT_MANAGER: STAFF_FIELDS,
    Role.SECURITY_GUARD: STAFF_FIELDS,
    Role.STAFF: STAFF_FIELDS,
    Role.DRIVER: {"required": ["phone", "license_no"], "optional": ["employee_id"]},
    Role.PARENT: {"required": ["phone", "children"], "optional": []},
    Role.STUDENT: {"required": ["student_id"], "optional": ["phone"]},
}

FIELD_LABELS = {
    "phone": "Phone",
    "employee_id": "Employee ID",
    "designation": "Designation",
    "license_no": "Driving licence number",
    "children": "Children",
    "student_id": "Student record",
}

# Parent and student accounts are tied to student records, so they can't be
# switched to or from other roles after creation.
LINKED_ROLES = {Role.PARENT.value, Role.STUDENT.value}

RELATIONSHIPS = ["father", "mother", "guardian"]


def missing_fields(role: str, values: dict) -> list[str]:
    """Required fields for `role` that are empty in `values`."""
    rules = ROLE_RULES.get(role, {"required": []})
    return [f for f in rules["required"] if not values.get(f)]
