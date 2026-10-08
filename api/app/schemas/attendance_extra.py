"""School calendar, leave requests, QR scans, biometric devices, period-wise attendance."""
import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Day = date  # for fields named "date"
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


# ---- calendar ---------------------------------------------------------------------------------

EventKind = Literal["holiday", "vacation", "event", "exam", "ptm"]


class EventIn(BaseModel):
    title: Title
    kind: EventKind
    start_date: date
    end_date: date | None = None
    description: Text | None = None

    @model_validator(mode="after")
    def _range(self):
        self.end_date = self.end_date or self.start_date
        if self.end_date < self.start_date:
            raise ValueError("end_date: The end date is before the start date")
        if (self.end_date - self.start_date).days > 92:
            raise ValueError("end_date: An event can last at most three months")
        return self


class EventOut(BaseModel):
    id: uuid.UUID
    title: str
    kind: str
    start_date: date
    end_date: date
    description: str | None
    closed: bool  # no attendance on these days


# ---- leave requests ---------------------------------------------------------------------------

LeaveKind = Literal["sick", "family", "travel", "other"]


class LeaveIn(BaseModel):
    student_id: uuid.UUID
    from_date: date
    to_date: date
    kind: LeaveKind = "sick"
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]

    @model_validator(mode="after")
    def _range(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date: The last day is before the first day")
        if (self.to_date - self.from_date).days > 60:
            raise ValueError("to_date: Ask for at most 60 days at a time")
        return self


class LeaveDecision(BaseModel):
    approve: bool
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class LeaveOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_section: str
    from_date: date
    to_date: date
    days: int  # school days in the range
    kind: str
    reason: str
    status: str
    requested_by: str | None
    requested_at: datetime
    decided_by: str | None
    decided_at: datetime | None
    decision_note: str | None
    can_decide: bool = False
    can_cancel: bool = False


# ---- QR scan ----------------------------------------------------------------------------------

class ScanIn(BaseModel):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class ScanOut(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    photo_file_id: uuid.UUID | None
    status: str
    already: bool  # was already marked present today
    time: datetime


# ---- biometric devices ------------------------------------------------------------------------

class DeviceIn(BaseModel):
    serial_no: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_\-]+$")]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    is_enabled: bool = True


class DeviceOut(BaseModel):
    id: uuid.UUID
    serial_no: str
    name: str
    location: str | None
    is_enabled: bool
    last_seen: datetime | None
    punches: int
    online: bool


class PunchOut(BaseModel):
    pin: str
    punched_at: datetime
    device: str
    matched: str | None  # the person's name, if the number is enrolled


class BiometricIds(BaseModel):
    """Numbers enrolled on the machines: {student_id or user_id: number}."""
    students: dict[uuid.UUID, Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] | None] = Field(default_factory=dict)
    users: dict[uuid.UUID, Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] | None] = Field(default_factory=dict)


# ---- period-wise ------------------------------------------------------------------------------

class PeriodCard(BaseModel):
    entry_id: uuid.UUID
    period_name: str
    start_time: str
    end_time: str
    section_id: uuid.UUID
    section_label: str
    subject_name: str
    subject_color: str
    marked: bool
    absent: int
    cover: bool = False  # taken as a substitute


class PeriodStudent(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    day_status: str | None  # from the morning roll call
    absent: bool


class PeriodRoster(BaseModel):
    entry_id: uuid.UUID
    date: Day
    label: str
    marked: bool
    students: list[PeriodStudent]


class PeriodSave(BaseModel):
    date: Day
    absent_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)


class BunkRow(BaseModel):
    """Present at roll call but missing from a period."""
    student_id: uuid.UUID
    name: str
    section_label: str
    periods: list[str]
