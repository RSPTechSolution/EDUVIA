import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Status = Literal["present", "absent", "late", "half_day", "leave"]


class Counts(BaseModel):
    present: int = 0
    absent: int = 0
    late: int = 0
    half_day: int = 0
    leave: int = 0

    @property
    def marked(self) -> int:
        return self.present + self.absent + self.late + self.half_day + self.leave

    def percent(self) -> float | None:
        """Share of school days attended. Late counts as present, half day as half; leave days are excluded."""
        days = self.marked - self.leave
        if days <= 0:
            return None
        return round(100 * (self.present + self.late + 0.5 * self.half_day) / days, 1)


class SectionCard(BaseModel):
    section_id: uuid.UUID
    label: str
    class_teacher: str | None
    is_class_teacher: bool
    students: int
    marked: int
    present: int
    absent: int
    marked_by: str | None = None


class RosterEntry(BaseModel):
    student_id: uuid.UUID
    name: str
    admission_no: str
    roll_no: int | None
    gender: str
    status: Status | None
    remark: str | None
    recent_percent: float | None  # last 30 days


class Roster(BaseModel):
    section_id: uuid.UUID
    label: str
    date: date
    editable: bool
    locked_reason: str | None = None
    marked_by: str | None
    marked_at: datetime | None
    students: list[RosterEntry]
    counts: Counts


class MarkEntry(BaseModel):
    student_id: uuid.UUID
    status: Status
    remark: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None


class MarkRequest(BaseModel):
    date: date
    records: list[MarkEntry] = Field(min_length=1, max_length=200)


class DayStatus(BaseModel):
    date: date
    status: Status
    remark: str | None = None


class StudentAttendance(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    month: str  # YYYY-MM
    days: list[DayStatus]
    month_counts: Counts
    month_percent: float | None
    year_counts: Counts
    year_percent: float | None


class ReportRow(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    counts: Counts
    percent: float | None


class SectionReport(BaseModel):
    section_id: uuid.UUID
    label: str
    month: str
    school_days: int
    rows: list[ReportRow]
    average_percent: float | None


class TrendPoint(BaseModel):
    date: date
    percent: float | None
    marked: int


class Overview(BaseModel):
    date: date
    sections_total: int
    sections_marked: int
    students_total: int
    counts: Counts
    percent: float | None
    sections: list[SectionCard]
    trend: list[TrendPoint]
    low_attendance: list[ReportRow]  # below 75% over the last 30 days
