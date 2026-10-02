import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.dependencies import get_db_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.finance import FeeStructureCreate, FeeInvoiceCreate, FeePaymentCreate, ExpenseCreate
from app.services.fee_service import collect_fee
from app.services.tally_service import export_tally_xml
from app.services.gateways import get_gateway

router = APIRouter(prefix="/api/v1/finance", tags=["finance"])

@router.get("/dashboard")
async def get_dashboard():
    mock_invoices = [
      { "id": 1, "student": 'John Doe', "invoice_no": 'INV-2023-001', "class_name": 'Class 10 A', "total": 15000, "balance": 15000, "due_date": '2023-11-01', "status": 'unpaid' },
      { "id": 2, "student": 'Jane Smith', "invoice_no": 'INV-2023-002', "class_name": 'Class 9 B', "total": 12000, "balance": 0, "due_date": '2023-10-15', "status": 'paid' },
      { "id": 3, "student": 'Alice Wong', "invoice_no": 'INV-2023-003', "class_name": 'Class 10 A', "total": 15000, "balance": 5000, "due_date": '2023-10-01', "status": 'partial' },
    ]
    stats = { "outstanding": 120000, "today": 45000, "month": 350000, "rate": 85 }
    return {"success": True, "data": {"invoices": mock_invoices, "stats": stats}}

@router.get("/analytics")
async def get_analytics():
    monthly_data = [
      { "name": 'Apr', "collected": 400000, "target": 450000 },
      { "name": 'May', "collected": 300000, "target": 350000 },
      { "name": 'Jun', "collected": 200000, "target": 200000 },
      { "name": 'Jul', "collected": 278000, "target": 250000 },
      { "name": 'Aug', "collected": 189000, "target": 200000 },
      { "name": 'Sep', "collected": 239000, "target": 250000 },
    ]
    category_data = [
      { "name": 'Tuition', "amount": 800000 },
      { "name": 'Transport', "amount": 300000 },
      { "name": 'Library', "amount": 50000 },
      { "name": 'Hostel', "amount": 200000 },
    ]
    return {"success": True, "data": {"monthly": monthly_data, "category": category_data}}

@router.get("/defaulters")
async def get_defaulters():
    defaulters = [
      { "id": 1, "student": 'Mike Johnson', "class_name": 'Class 10 A', "overdue_days": 45, "amount": 15000, "status": 'critical', "parent_phone": '+91 9876543210' },
      { "id": 2, "student": 'Sarah Connor', "class_name": 'Class 9 B', "overdue_days": 15, "amount": 8000, "status": 'warning', "parent_phone": '+91 9876543211' },
      { "id": 3, "student": 'Tom Hanks', "class_name": 'Class 8 A', "overdue_days": 60, "amount": 25000, "status": 'critical', "parent_phone": '+91 9876543212' },
    ]
    return {"success": True, "data": defaulters}

@router.get("/structure")
async def get_structure():
    structures = [
      { "id": 1, "name": 'Grade 10 General', "frequency": 'monthly', "amount": 5000, "components": 3, "status": 'active' },
      { "id": 2, "name": 'Grade 9 General', "frequency": 'monthly', "amount": 4500, "components": 3, "status": 'active' },
      { "id": 3, "name": 'Bus Transport (Zone A)', "frequency": 'quarterly', "amount": 9000, "components": 1, "status": 'active' },
    ]
    return {"success": True, "data": structures}
@router.post("/invoices/{invoice_id}/pay")
async def pay_invoice(
    invoice_id: uuid.UUID,
    data: FeePaymentCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    payment = await collect_fee(db, invoice_id, data.amount, data.method, current_user.id)
    return {"success": True, "data": {"receipt_no": payment.receipt_no}}

@router.post("/invoices/{invoice_id}/pay-online")
async def pay_invoice_online(
    invoice_id: uuid.UUID,
    gateway: str,
    db: AsyncSession = Depends(get_db_session)
):
    gw = get_gateway(gateway, {})
    order = await gw.create_order(50000, str(invoice_id))
    return {"success": True, "data": order.gateway_data}

@router.post("/webhook/{gateway}")
async def gateway_webhook(
    gateway: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    body = await request.body()
    gw = get_gateway(gateway, {})
    sig = request.headers.get(f"X-{gateway.title()}-Signature", "")
    if not gw.verify_webhook_signature(body, sig):
        raise HTTPException(status_code=400, detail="Invalid signature")
    return {"success": True}

@router.get("/export/tally")
async def export_tally(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    xml_data = await export_tally_xml(db, current_user.school_id, from_date, to_date)
    return Response(content=xml_data, media_type="application/xml")
