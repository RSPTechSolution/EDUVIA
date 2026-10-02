import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.finance import FeeInvoice, FeePayment, FeeStructure
from app.models.academics import Student
from app.models.school import School
# Mock for weasyprint due to environment dependencies
# from weasyprint import HTML
# from jinja2 import Environment, FileSystemLoader

async def generate_receipt_pdf(payment: FeePayment, invoice: FeeInvoice, student: Student, school: School) -> bytes:
    # return HTML(string="<html>Receipt</html>").write_pdf()
    return b"%PDF-1.4 mock pdf data"

async def collect_fee(db: AsyncSession, invoice_id: uuid.UUID, amount: Decimal, method: str, collected_by: uuid.UUID) -> FeePayment:
    invoice = await db.get(FeeInvoice, invoice_id)
    if not invoice:
        raise ValueError("Invoice not found")

    receipt_no = f"RCP-{invoice.school_id.hex[:6].upper()}-{int(datetime.utcnow().timestamp())}"
    payment = FeePayment(
        school_id=invoice.school_id, invoice_id=invoice_id,
        amount=amount, method=method, receipt_no=receipt_no,
        collected_by=collected_by,
    )
    db.add(payment)

    # Update invoice status
    invoice.paid_amount += amount
    if invoice.paid_amount >= invoice.total_amount - invoice.discount:
        invoice.status = "paid"
    elif invoice.paid_amount > 0:
        invoice.status = "partial"

    await db.flush()

    # Generate and store PDF
    student = await db.get(Student, invoice.student_id)
    school = await db.get(School, invoice.school_id)
    pdf_bytes = await generate_receipt_pdf(payment, invoice, student, school)
    
    # Mock upload
    pdf_url = f"https://mockstorage/receipts/{receipt_no}.pdf"
    payment.receipt_url = pdf_url
    await db.commit()
    await db.refresh(payment)
    return payment
