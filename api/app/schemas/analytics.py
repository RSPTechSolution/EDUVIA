"""School analytics."""
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
Day = date


class ClassEnrolment(BaseModel):
    class_id: uuid.UUID
    name: str
    students: int
    boys: int
    girls: int


class TrendPoint(BaseModel):
    date: Day
    percent: float | None


class ClassAttendance(BaseModel):
    class_id: uuid.UUID
    name: str
    percent: float | None


class MonthAmount(BaseModel):
    month: str
    amount: Num


class AgingBucket(BaseModel):
    label: str
    amount: Num


class Defaulter(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    balance: Num
    days_overdue: int


class FeeSummary(BaseModel):
    billed: Num
    collected: Num
    outstanding: Num
    collection_percent: float | None
    monthly: list[MonthAmount]
    aging: list[AgingBucket]
    defaulters: list[Defaulter]


class ClassResult(BaseModel):
    class_id: uuid.UUID
    name: str
    students: int
    average: float
    pass_rate: float | None


class SubjectResult(BaseModel):
    name: str
    average: float


class ExamSummary(BaseModel):
    exam_id: uuid.UUID
    name: str
    pass_rate: float | None
    classes: list[ClassResult]
    subjects: list[SubjectResult]


class AtRisk(BaseModel):
    student_id: uuid.UUID
    name: str
    admission_no: str
    class_section: str
    reasons: list[str]


class AnalyticsReport(BaseModel):
    frm: Day
    to: Day
    academic_year: str
    students: int
    new_admissions: int
    enrolment: list[ClassEnrolment]
    attendance_percent: float | None
    attendance_trend: list[TrendPoint]
    class_attendance: list[ClassAttendance]
    low_attendance: int
    fees: FeeSummary
    exam: ExamSummary | None
    at_risk: list[AtRisk]
    at_risk_total: int
