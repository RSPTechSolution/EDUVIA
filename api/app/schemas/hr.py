"""Staff profiles, staff attendance, leave, payroll."""
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints, model_validator

Day = date
Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
Pay = Annotated[Decimal, Field(ge=0, le=10_000_000, decimal_places=2)]
Opt = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None


class ProfileIn(BaseModel):
    department: Opt = None
    date_of_joining: date | None = None
    date_of_birth: date | None = None
    qualification: Opt = None
    pan: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z]{5}[0-9]{4}[A-Za-z]$")] | None = None
    uan: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{12}$")] | None = None
    bank_name: Opt = None
    bank_account: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{6,20}$")] | None = None
    ifsc: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z]{4}0[A-Za-z0-9]{6}$")] | None = None
    basic: Pay = Decimal(0)
    hra: Pay = Decimal(0)
    da: Pay = Decimal(0)
    conveyance: Pay = Decimal(0)
    special: Pay = Decimal(0)
    pf_enabled: bool = True
    esi_enabled: bool = True
    professional_tax: Pay = Decimal(200)
    tds: Pay = Decimal(0)


class StaffRow(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    role: str
    employee_id: str | None
    designation: str | None
    department: str | None
    date_of_joining: Day | None
    gross_monthly: Num
    has_bank: bool
    today: str | None  # today's attendance status


class StaffDetail(StaffRow):
    profile: dict
    leave_balance: list[dict]


class DayMark(BaseModel):
    user_id: uuid.UUID
    status: Literal["present", "absent", "half_day", "leave", "late"]
    check_in: time | None = None
    check_out: time | None = None


class StaffAttendanceSave(BaseModel):
    date: Day
    records: list[DayMark] = Field(min_length=1, max_length=500)


class StaffDayRow(BaseModel):
    user_id: uuid.UUID
    full_name: str
    role: str
    designation: str | None
    status: str | None
    check_in: str | None
    check_out: str | None
    source: str | None
    on_leave: bool


class LeaveTypeIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    code: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=10)]
    days_per_year: int = Field(12, ge=0, le=365)
    paid: bool = True
    is_active: bool = True


class LeaveTypeOut(LeaveTypeIn):
    id: uuid.UUID


class StaffLeaveIn(BaseModel):
    leave_type_id: uuid.UUID
    from_date: Day
    to_date: Day
    half_day: bool = False
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]
    user_id: uuid.UUID | None = None  # HR applying on someone's behalf

    @model_validator(mode="after")
    def _range(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date: The last day is before the first day")
        if self.half_day and self.to_date != self.from_date:
            raise ValueError("half_day: A half day is a single day")
        return self


class StaffLeaveOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    leave_type: str
    code: str
    from_date: Day
    to_date: Day
    half_day: bool
    days: Num
    reason: str
    status: str
    decided_by: str | None
    decision_note: str | None
    created_at: datetime
    can_decide: bool = False
    can_cancel: bool = False


class Decision(BaseModel):
    approve: bool
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class RunIn(BaseModel):
    month: Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


class PayslipOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    employee_id: str | None
    designation: str | None
    days_in_month: int
    paid_days: Num
    lop_days: Num
    earnings: dict
    deductions: dict
    adjustments: dict
    gross: Num
    total_deductions: Num
    net: Num
    note: str | None
    bank_ready: bool


class RunOut(BaseModel):
    id: uuid.UUID
    month: str
    status: str
    staff: int
    gross: Num
    net: Num
    finalised_at: datetime | None
    paid_on: Day | None
    payslips: list[PayslipOut] = []


class Adjust(BaseModel):
    adjustments: dict[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)],
                      Annotated[Decimal, Field(ge=-1_000_000, le=1_000_000, decimal_places=2)]] = Field(default_factory=dict, max_length=10)
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class MarkPaid(BaseModel):
    paid_on: Day
