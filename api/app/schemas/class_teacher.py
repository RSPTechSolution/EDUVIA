"""The class teacher's (incharge's) view of their class."""
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]


class MyClass(BaseModel):
    section_id: uuid.UUID
    label: str
    is_class_teacher: bool
    students: int
    attendance_marked: bool
    present: int
    absent: int
    on_leave: int
    pending_leave: int
    pending_gate_passes: int
    fees_enabled: bool
    students_overdue: int
    overdue_amount: Num


class ClassStudent(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    admission_no: str
    photo_file_id: uuid.UUID | None
    today: str | None
    attendance_percent: float | None
    days_absent: int
    fee_due: Num
    fee_overdue: bool
    guardians: list[str]


class MyClassDetail(BaseModel):
    section_id: uuid.UUID
    label: str
    class_teacher: str | None
    fees_enabled: bool
    month_start: date
    students: list[ClassStudent]


class ClassReminderIn(BaseModel):
    overdue_only: bool = True
