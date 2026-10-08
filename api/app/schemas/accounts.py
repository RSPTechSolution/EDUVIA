"""Late fees, fee reminders, and the school accounts (income/expense heads, day book, summary)."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints, model_validator

Day = date
Amount = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
PositiveAmount = Annotated[Decimal, Field(gt=0, le=Decimal("99999999.99"), decimal_places=2)]


class LateFeeRule(BaseModel):
    enabled: bool = False
    mode: Literal["flat", "per_day"] = "flat"
    amount: Annotated[Decimal, Field(ge=0, le=100000, decimal_places=2), PlainSerializer(float, return_type=float)] = Decimal(0)
    grace_days: int = Field(0, ge=0, le=90)
    max_amount: Annotated[Decimal, Field(ge=0, le=100000, decimal_places=2), PlainSerializer(float, return_type=float)] | None = None

    @model_validator(mode="after")
    def _amount(self):
        if self.enabled and self.amount <= 0:
            raise ValueError("amount: Enter the late fee amount")
        return self


class LateFeeResult(BaseModel):
    invoices: int
    added: Amount


class ReminderRequest(BaseModel):
    overdue_only: bool = True
    class_id: uuid.UUID | None = None
    term: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None


class ReminderResult(BaseModel):
    invoices: int
    families: int
    emails: int
    skipped_recent: int  # reminded in the last 3 days


# ---- accounts ---------------------------------------------------------------------------------

Kind = Literal["income", "expense"]
Method = Literal["cash", "bank_transfer", "upi", "cheque", "card"]


class HeadIn(BaseModel):
    kind: Kind
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    is_active: bool = True


class HeadOut(BaseModel):
    id: uuid.UUID
    kind: str
    name: str
    is_active: bool
    total_this_year: Amount = Decimal(0)


class EntryIn(BaseModel):
    kind: Kind
    head_id: uuid.UUID
    date: Day
    amount: PositiveAmount
    party: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    method: Method = "cash"
    reference: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None

    @model_validator(mode="after")
    def _ref(self):
        if self.method == "cheque" and not self.reference:
            raise ValueError("reference: Enter the cheque number")
        return self


class EntryOut(BaseModel):
    id: uuid.UUID
    voucher_no: str
    kind: str
    head_id: uuid.UUID
    head_name: str
    date: Day
    amount: Amount
    party: str | None
    method: str
    reference: str | None
    note: str | None
    created_by: str | None
    created_at: datetime
    attachments: int = 0


class HeadTotal(BaseModel):
    name: str
    amount: Amount


class MonthTotal(BaseModel):
    month: str  # YYYY-MM
    income: Amount
    expense: Amount


class AccountsSummary(BaseModel):
    start: Day
    end: Day
    fee_income: Amount
    other_income: Amount
    expense: Amount
    net: Amount
    income_by_head: list[HeadTotal]  # fees broken down by method, then other income heads
    expense_by_head: list[HeadTotal]
    by_month: list[MonthTotal]
    cash_in_hand: Amount  # cash received minus cash paid, in the period
