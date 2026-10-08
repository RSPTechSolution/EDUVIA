import uuid
from datetime import datetime

from typing import Annotated

from typing import Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, field_validator

from app.core.permissions import SCHOOL_ROLES
from app.schemas.auth import NewPassword
from app.schemas.common import Schema

_ROLE_VALUES = {r.value for r in SCHOOL_ROLES}


def _role(v: str | None):
    if v is not None and v not in _ROLE_VALUES:
        raise ValueError(f"Role must be one of: {', '.join(sorted(_ROLE_VALUES))}")
    return v


SchoolRole = Annotated[str, AfterValidator(_role)]


class UserOut(Schema):
    id: uuid.UUID
    school_id: uuid.UUID | None
    email: str
    full_name: str
    phone: str | None
    role: str
    employee_id: str | None = None
    designation: str | None = None
    license_no: str | None = None
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    photo_file_id: uuid.UUID | None = None
    created_at: datetime


class ChildLink(BaseModel):
    student_id: uuid.UUID
    relationship: Literal["father", "mother", "guardian"]


def _blank_to_none(v):
    return v.strip() or None if isinstance(v, str) else v


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(None, max_length=20)
    role: SchoolRole
    password: NewPassword
    # Role-specific; see app.core.roles for what each role requires.
    employee_id: str | None = Field(None, max_length=50)
    designation: str | None = Field(None, max_length=100)
    license_no: str | None = Field(None, max_length=50)
    children: list[ChildLink] | None = Field(None, max_length=10)  # parents
    student_id: uuid.UUID | None = None  # students

    @field_validator("phone", "employee_id", "designation", "license_no", mode="before")
    @classmethod
    def _blank(cls, v):
        return _blank_to_none(v)


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    phone: str | None = Field(None, max_length=20)
    role: SchoolRole | None = None
    is_active: bool | None = None
    employee_id: str | None = Field(None, max_length=50)
    designation: str | None = Field(None, max_length=100)
    license_no: str | None = Field(None, max_length=50)

    @field_validator("phone", "employee_id", "designation", "license_no", mode="before")
    @classmethod
    def _blank(cls, v):
        return _blank_to_none(v)


class LinkedChild(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    relationship: str


class UserDetail(UserOut):
    children: list[LinkedChild] = []  # parents
    student_id: uuid.UUID | None = None  # students
    student_name: str | None = None


class AdminSetPassword(BaseModel):
    password: NewPassword


class AuditLogOut(Schema):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_name: str | None = None
    action: str
    entity_type: str | None
    entity_id: str | None
    meta: dict
    ip_address: str | None
    created_at: datetime
