"""Everything about one person across the modules, for their profile and detail pages."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]


class LoanRow(BaseModel):
    title: str
    author: str | None
    accession_no: str
    issued_on: date
    due_on: date
    returned_on: date | None
    overdue: bool
    fine: Num


class LibrarySummary(BaseModel):
    current: list[LoanRow]
    recent_returns: list[LoanRow]
    returned_total: int
    fines_due: Num


class HostelStay(BaseModel):
    hostel: str
    room: str
    floor: str | None
    since: date


class BusSummary(BaseModel):
    route: str
    stop: str | None
    pickup_time: str | None
    drop_time: str | None
    vehicle_number: str | None
    driver_name: str | None
    driver_phone: str | None


class ExamResult(BaseModel):
    exam_id: uuid.UUID
    name: str
    percent: float | None
    papers: int
    absent: int


class HomeworkSummary(BaseModel):
    pending: int
    overdue: int
    done: int
    checked: int


class RequestRow(BaseModel):
    """A leave request or gate pass, for the student, their parent or the staff member concerned."""
    kind: str  # leave | gate_pass | staff_leave
    title: str
    detail: str | None
    status: str
    on: date
    student_id: uuid.UUID | None = None
    student_name: str | None = None


class CertificateRow(BaseModel):
    kind: str
    serial_no: str
    issued_on: date


class TestRow(BaseModel):
    title: str
    score: Num | None
    submitted_at: datetime | None
    needs_marking: bool


class PtmRow(BaseModel):
    title: str
    on: date
    slot: str
    teacher_name: str | None
    student_name: str | None


class Sibling(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str


class StudentOverview(BaseModel):
    """Only the modules the school uses are filled in; the others are None."""
    library: LibrarySummary | None = None
    hostel: HostelStay | None = None
    bus: BusSummary | None = None
    results: list[ExamResult] | None = None
    homework: HomeworkSummary | None = None
    requests: list[RequestRow] = []
    certificates: list[CertificateRow] | None = None
    tests: list[TestRow] | None = None
    ptm: list[PtmRow] | None = None
    siblings: list[Sibling] = []


class Payslip(BaseModel):
    month: str
    net: Num


class HrSummary(BaseModel):
    department: str | None
    joined_on: date | None
    qualification: str | None
    present_days: int  # this month
    absent_days: int
    leave_days: Num
    requests: list[RequestRow]
    latest_payslip: Payslip | None


class BusDuty(BaseModel):
    vehicle_number: str
    routes: list[str]
    helper: str | None


class TripRow(BaseModel):
    route: str
    direction: str
    status: str
    started_at: datetime
    ended_at: datetime | None


class LiveClassRow(BaseModel):
    title: str
    starts_at: datetime
    sections: list[str]


class VisitorRow(BaseModel):
    name: str
    purpose: str
    status: str
    on: datetime | date | None
