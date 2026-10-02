import uuid
from datetime import datetime

from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field

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
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(None, max_length=20)
    role: SchoolRole
    password: NewPassword


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    phone: str | None = Field(None, max_length=20)
    role: SchoolRole | None = None
    is_active: bool | None = None


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
