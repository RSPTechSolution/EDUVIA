"""Gate and security: visitors, gate passes, workers, compliance vault, CCTV."""
import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9 ()-]{7,20}$")]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]
Text200 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]


# ---- visitors ---------------------------------------------------------------------------------

class VisitorIn(BaseModel):
    """At the gate: the visitor is coming in now."""
    name: Name
    phone: Phone | None = None
    purpose: Text200
    meeting: Annotated[str, StringConstraints(strip_whitespace=True, max_length=150)] | None = None
    host_id: uuid.UUID | None = None
    id_proof: Short | None = None
    vehicle_no: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, max_length=20)] | None = None
    people: int = Field(1, ge=1, le=50)
    badge_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None


class InviteIn(BaseModel):
    """A staff member expects someone."""
    name: Name
    phone: Phone | None = None
    purpose: Text200
    expected_on: date
    people: int = Field(1, ge=1, le=50)


class ArriveIn(BaseModel):
    id_proof: Short | None = None
    vehicle_no: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, max_length=20)] | None = None
    badge_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None
    people: int | None = Field(None, ge=1, le=50)


class VisitorOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    purpose: str
    meeting: str | None
    host_id: uuid.UUID | None
    host_name: str | None
    id_proof: str | None
    vehicle_no: str | None
    people: int
    badge_no: str | None
    status: str
    expected_on: date | None
    in_at: datetime | None
    out_at: datetime | None
    photo_file_id: uuid.UUID | None
    logged_by: str | None
    can_cancel: bool = False


class VisitorLookup(BaseModel):
    name: str
    purpose: str
    meeting: str | None
    visits: int
    last_at: datetime | None


# ---- gate passes ------------------------------------------------------------------------------

class GatePassIn(BaseModel):
    student_id: uuid.UUID
    reason: Text200
    pickup_name: Name
    pickup_relation: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=50)]
    pickup_phone: Phone | None = None
    leave_at: datetime


class GatePassDecision(BaseModel):
    approve: bool
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class GatePassOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_section: str
    photo_file_id: uuid.UUID | None
    reason: str
    pickup_name: str
    pickup_relation: str
    pickup_phone: str | None
    leave_at: datetime
    status: str
    code: str | None  # only for the family, the office and the gate
    requested_by: str | None
    decided_by: str | None
    decision_note: str | None
    used_at: datetime | None
    verified_by: str | None
    can_decide: bool = False
    can_cancel: bool = False


# ---- workers ----------------------------------------------------------------------------------

class WorkerIn(BaseModel):
    name: Name
    phone: Phone | None = None
    trade: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    agency: Annotated[str, StringConstraints(strip_whitespace=True, max_length=150)] | None = None
    id_proof: Short | None = None
    police_verified: bool = False
    verified_on: date | None = None
    valid_until: date | None = None
    is_active: bool = True
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


class WorkerOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    trade: str
    agency: str | None
    id_proof: str | None
    police_verified: bool
    verified_on: date | None
    valid_until: date | None
    is_active: bool
    notes: str | None
    photo_file_id: uuid.UUID | None
    on_campus_since: datetime | None
    can_enter: bool
    blocked_reason: str | None


class WorkerLogOut(BaseModel):
    id: uuid.UUID
    worker_id: uuid.UUID
    name: str
    trade: str
    in_at: datetime
    out_at: datetime | None


# ---- compliance -------------------------------------------------------------------------------

class ComplianceIn(BaseModel):
    title: Text200
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    reference_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    authority: Annotated[str, StringConstraints(strip_whitespace=True, max_length=150)] | None = None
    issued_on: date | None = None
    expires_on: date | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None = None


class ComplianceOut(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    reference_no: str | None
    authority: str | None
    issued_on: date | None
    expires_on: date | None
    notes: str | None
    state: Literal["valid", "expiring", "expired", "no_expiry"]
    days_left: int | None
    files: int


class GateSummary(BaseModel):
    visitors_inside: int
    visitors_today: int
    expected_today: int
    workers_inside: int
    passes_pending: int
    passes_today: int
    compliance_due: int


# ---- CCTV -------------------------------------------------------------------------------------

class CctvSettings(BaseModel):
    policy: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] = (
        "Classroom cameras record during school hours for the safety of students and staff. Recordings are kept for 30 days and are "
        "only viewed by the principal or on a police request. With your consent, and only if every family in the class agrees, you may "
        "watch your child's classroom live during school hours."
    )
    parent_viewing: bool = False


class CameraIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=150)] | None = None
    section_id: uuid.UUID | None = None
    stream_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^(https?|rtsp)://")] | None = None
    parent_viewable: bool = False
    is_active: bool = True


class CameraOut(BaseModel):
    id: uuid.UUID
    name: str
    location: str | None
    section_id: uuid.UUID | None
    section_label: str | None
    stream_url: str | None  # managers only
    parent_viewable: bool
    is_active: bool
    consent: dict | None = None  # {students, yes, no, unanswered, complete}
    watchable: bool = False
    blocked_reason: str | None = None


class ConsentRow(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    consent: bool | None
    decided_at: datetime | None


class ConsentIn(BaseModel):
    student_id: uuid.UUID
    consent: bool


class ConsentCoverage(BaseModel):
    section_id: uuid.UUID
    label: str
    students: int
    yes: int
    no: int
    unanswered: int


class WatchOut(BaseModel):
    camera_id: uuid.UUID
    name: str
    stream_url: str


class ViewLogRow(BaseModel):
    camera: str
    user: str | None
    role: str | None
    at: datetime
