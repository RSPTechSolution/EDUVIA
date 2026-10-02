import uuid
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from decimal import Decimal

class FeeStructureCreate(BaseModel):
    academic_year_id: uuid.UUID
    class_id: uuid.UUID
    fee_category_id: uuid.UUID
    amount: Decimal
    frequency: str
    installments: Optional[list] = None

class FeeInvoiceCreate(BaseModel):
    student_id: uuid.UUID
    academic_year_id: uuid.UUID
    total_amount: Decimal
    due_date: datetime

class FeePaymentCreate(BaseModel):
    amount: Decimal
    method: str

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: Decimal
    vendor: Optional[str] = None
    expense_date: date
    receipt: Optional[str] = None
