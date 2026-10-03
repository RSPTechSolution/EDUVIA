import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, StringConstraints, model_validator

# Money is stored exactly (Decimal) and sent to clients as a plain number.
Amount = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
PositiveAmount = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Method = Literal["cash", "upi", "cheque", "card", "bank_transfer"]


# ---- categories & structures ------------------------------------------------------------------

class CategoryIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Text | None = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    description: Text | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool


class StructureItem(BaseModel):
    category_id: uuid.UUID
    amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


class StructureSet(BaseModel):
    class_id: uuid.UUID
    items: list[StructureItem] = Field(max_length=50)


class StructureClass(BaseModel):
    class_id: uuid.UUID
    class_name: str
    students: int
    amounts: dict[str, Amount]  # category_id -> amount per term
    total: Amount


class StructureMatrix(BaseModel):
    categories: list[CategoryOut]
    classes: list[StructureClass]


class GenerateInvoices(BaseModel):
    term: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    due_date: date
    class_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)  # empty = every class
    category_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)  # empty = every active category


class GenerateResult(BaseModel):
    created: int
    skipped_existing: int
    skipped_zero: int
    total_billed: Amount


# ---- invoices & payments ----------------------------------------------------------------------

class InvoiceRow(BaseModel):
    id: uuid.UUID
    invoice_no: str
    student_id: uuid.UUID
    student_name: str
    admission_no: str
    class_section: str
    term: str
    due_date: date
    total: Amount
    discount: Amount
    paid: Amount
    balance: Amount
    status: str
    overdue: bool


class InvoiceItemOut(BaseModel):
    name: str
    amount: Amount


class PaymentOut(BaseModel):
    id: uuid.UUID
    receipt_no: str
    amount: Amount
    method: str
    reference: str | None
    note: str | None
    paid_at: datetime
    collected_by: str | None  # staff member, or "Paid online by <parent>"


class InvoiceDetail(InvoiceRow):
    academic_year: str
    issue_date: date
    discount_reason: str | None
    items: list[InvoiceItemOut]
    payments: list[PaymentOut]
    guardian_phone: str | None = None


class CollectPayment(BaseModel):
    amount: PositiveAmount
    method: Method
    reference: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    note: Text | None = None

    @model_validator(mode="after")
    def _reference(self):
        if self.method in ("cheque", "bank_transfer") and not self.reference:
            raise ValueError("Enter the cheque or transaction number")
        return self


class DiscountSet(BaseModel):
    amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]


class Receipt(BaseModel):
    payment: PaymentOut
    invoice: InvoiceDetail
    school_name: str
    school_address: str | None
    school_phone: str | None
    balance_after: Amount


# ---- dashboard --------------------------------------------------------------------------------

class DayAmount(BaseModel):
    date: date
    amount: Amount


class MethodAmount(BaseModel):
    method: str
    amount: Amount
    count: int


class ClassDue(BaseModel):
    class_name: str
    outstanding: Amount
    students: int


class FeeSummary(BaseModel):
    collected_today: Amount
    collected_month: Amount
    collected_year: Amount
    billed_year: Amount
    outstanding: Amount
    overdue: Amount
    overdue_invoices: int
    collection_rate: float | None  # paid share of what has fallen due
    daily: list[DayAmount]
    by_method: list[MethodAmount]
    by_class: list[ClassDue]
    recent: list[PaymentOut]


# ---- parents & students -----------------------------------------------------------------------

class ChildFees(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    due: Amount
    overdue: Amount
    next_due_date: date | None
    invoices: list[InvoiceDetail]


class MyFees(BaseModel):
    children: list[ChildFees]
    total_due: Amount
    online_payments: bool
    test_mode: bool


class OrderOut(BaseModel):
    order_id: uuid.UUID
    amount: Amount
    gateway: str
    test_mode: bool
    invoice_no: str
    description: str


class ConfirmOrder(BaseModel):
    outcome: Literal["success", "failure"] = "success"


class OrderResult(BaseModel):
    status: str
    payment: PaymentOut | None = None
    message: str
