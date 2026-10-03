import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.auth import NewPassword
from app.schemas.common import Schema

Gender = Literal["male", "female", "other"]
Relationship = Literal["father", "mother", "guardian"]
BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
StudentStatus = Literal["active", "inactive", "alumni"]


# ---- classes & sections -------------------------------------------------------------------

class SectionOut(Schema):
    id: uuid.UUID
    class_id: uuid.UUID
    name: str
    capacity: int | None
    class_teacher_id: uuid.UUID | None
    class_teacher_name: str | None = None
    student_count: int = 0


class ClassOut(Schema):
    id: uuid.UUID
    name: str
    sort_order: int
    sections: list[SectionOut] = []
    student_count: int = 0


def _clean_name(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("Enter a name")
    return v


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    sort_order: int | None = Field(None, ge=0, le=1000)
    sections: list[str] = Field(default_factory=lambda: ["A"], max_length=26)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("sections")
    @classmethod
    def _sections(cls, v: list[str]) -> list[str]:
        names = [" ".join(s.split()).upper() for s in v if s.strip()]
        if not names:
            raise ValueError("Add at least one section")
        if len(set(names)) != len(names):
            raise ValueError("Section names must be different")
        if any(len(n) > 20 for n in names):
            raise ValueError("Section names can be at most 20 characters")
        return names


class ClassUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    sort_order: int | None = Field(None, ge=0, le=1000)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return _clean_name(v) if v is not None else v


class ClassBulkCreate(BaseModel):
    names: list[str] = Field(min_length=1, max_length=40)
    sections: list[str] = Field(default_factory=lambda: ["A"], max_length=26)


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    capacity: int | None = Field(None, ge=1, le=500)
    class_teacher_id: uuid.UUID | None = None

    @field_validator("name")
    @classmethod
    def _upper(cls, v: str) -> str:
        return _clean_name(v).upper()


class SectionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=20)
    capacity: int | None = Field(None, ge=1, le=500)
    class_teacher_id: uuid.UUID | None = None

    @field_validator("name")
    @classmethod
    def _upper(cls, v: str | None) -> str | None:
        return _clean_name(v).upper() if v is not None else v


# ---- students -------------------------------------------------------------------------------

class NewParent(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=6, max_length=20)
    email: EmailStr
    password: NewPassword | None = None  # generated (and returned) when omitted


class GuardianLink(BaseModel):
    """Either an existing parent (user_id) or a new parent account (new_parent)."""
    user_id: uuid.UUID | None = None
    new_parent: NewParent | None = None
    relationship: Relationship
    is_primary: bool = False

    @model_validator(mode="after")
    def _one_source(self):
        if bool(self.user_id) == bool(self.new_parent):
            raise ValueError("Choose an existing parent or enter a new parent's details")
        return self


class StudentLogin(BaseModel):
    email: EmailStr
    password: NewPassword


class StudentBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    gender: Gender
    date_of_birth: date
    admission_no: str = Field(min_length=1, max_length=50)
    admission_date: date
    class_id: uuid.UUID
    section_id: uuid.UUID
    roll_no: int | None = Field(None, ge=1, le=10_000)
    blood_group: BloodGroup | None = None
    address: str | None = Field(None, max_length=1000)

    @field_validator("first_name", "last_name", "admission_no")
    @classmethod
    def _trim(cls, v: str) -> str:
        return _clean_name(v)

    @model_validator(mode="after")
    def _dates(self):
        today = date.today()
        if self.date_of_birth >= today:
            raise ValueError("Date of birth must be in the past")
        if self.date_of_birth.year < today.year - 30:
            raise ValueError("Check the date of birth")
        if self.admission_date < self.date_of_birth:
            raise ValueError("Admission date can't be before the date of birth")
        return self


class StudentCreate(StudentBase):
    guardians: list[GuardianLink] = Field(default_factory=list, max_length=4)
    login: StudentLogin | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    gender: Gender | None = None
    date_of_birth: date | None = None
    admission_no: str | None = Field(None, min_length=1, max_length=50)
    admission_date: date | None = None
    class_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    roll_no: int | None = Field(None, ge=1, le=10_000)
    blood_group: BloodGroup | None = None
    address: str | None = Field(None, max_length=1000)
    status: StudentStatus | None = None


class GuardianOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    phone: str | None
    email: str
    relationship: str
    is_primary: bool


class StudentOut(Schema):
    id: uuid.UUID
    admission_no: str
    first_name: str
    last_name: str
    gender: str
    date_of_birth: date
    admission_date: date
    class_id: uuid.UUID
    section_id: uuid.UUID
    class_name: str | None = None
    section_name: str | None = None
    roll_no: int | None
    blood_group: str | None
    address: str | None
    status: str
    user_id: uuid.UUID | None
    guardian_count: int = 0
    created_at: datetime


class StudentDetail(StudentOut):
    guardians: list[GuardianOut] = []
    login_email: str | None = None


class StudentCreated(BaseModel):
    student: StudentDetail
    # Temporary passwords generated for new parent accounts, to hand over once.
    new_parent_passwords: dict[str, str] = {}


class GuardianAdd(GuardianLink):
    pass


class StudentOption(BaseModel):
    """Compact row for pickers (e.g. linking a parent)."""
    id: uuid.UUID
    name: str
    admission_no: str
    class_section: str
    has_login: bool
