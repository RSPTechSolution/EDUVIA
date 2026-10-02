import re
import uuid
from datetime import datetime
from zoneinfo import available_timezones

from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field, field_validator

from app.schemas.auth import NewPassword
from app.schemas.common import Schema

_SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$")


def _tz(v: str | None):
    if v is not None and v not in available_timezones():
        raise ValueError("Unknown timezone")
    return v


TimeZone = Annotated[str, AfterValidator(_tz)]


class SchoolOut(Schema):
    id: uuid.UUID
    name: str
    slug: str
    domain: str | None
    logo_url: str | None
    address: str | None
    city: str | None
    state: str | None
    phone: str | None
    email: str | None
    timezone: str
    currency: str
    language: str
    is_active: bool
    plan: str
    settings: dict
    created_at: datetime


class SchoolUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    logo_url: str | None = Field(None, max_length=500)
    address: str | None = Field(None, max_length=500)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    timezone: TimeZone | None = None
    currency: str | None = Field(None, min_length=3, max_length=3)
    language: str | None = Field(None, max_length=10)
    settings: dict | None = None



class SchoolAdminUpdate(SchoolUpdate):
    """Fields only the platform super admin may change."""
    is_active: bool | None = None
    plan: str | None = Field(None, max_length=50)


class SchoolCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str
    timezone: TimeZone = "Asia/Kolkata"
    currency: str = Field("INR", min_length=3, max_length=3)
    language: str = "en"
    admin_full_name: str = Field(min_length=2, max_length=200)
    admin_email: EmailStr
    admin_password: NewPassword

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not _SLUG.match(v):
            raise ValueError("Slug must be 3-50 chars: lowercase letters, digits and hyphens")
        return v


class ModuleOut(BaseModel):
    module: str
    label: str
    is_enabled: bool


class ModuleToggle(BaseModel):
    is_enabled: bool
