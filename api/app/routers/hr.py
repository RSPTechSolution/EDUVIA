import uuid
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db_session
from app.services.hr_service import export_bank_advice_excel

router = APIRouter(prefix="/api/v1/hr", tags=["hr"])

@router.get("/staff")
async def get_staff():
    mock_staff = [
      { "id": 1, "name": 'Ramesh Kumar', "role": 'Teacher', "department": 'Science', "status": 'active', "attendance": '95%' },
      { "id": 2, "name": 'Anita Sharma', "role": 'Admin', "department": 'Office', "status": 'on-leave', "attendance": '82%' },
    ]
    return {"success": True, "data": mock_staff}

@router.get("/payroll/runs")
async def get_payroll_runs():
    mock_payroll = [
      { "id": 'run-001', "month": 'Oct 2023', "total_staff": 45, "processed": 45, "amount": 1250000, "status": 'disbursed' },
      { "id": 'run-002', "month": 'Nov 2023', "total_staff": 46, "processed": 0, "amount": 0, "status": 'draft' },
    ]
    return {"success": True, "data": mock_payroll}

@router.get("/payroll/details")
async def get_payroll_details():
    mock_payroll_details = [
      { "id": 1, "name": 'John Admin', "days": 30, "gross": 150000, "deductions": 12000, "net": 138000, "status": 'finalized' },
      { "id": 2, "name": 'Alice Teacher', "days": 28, "gross": 85000, "deductions": 5000, "net": 80000, "status": 'finalized' },
    ]
    return {"success": True, "data": mock_payroll_details}
@router.get("/payroll/{payroll_run_id}/bank-advice")
async def download_bank_advice(
    payroll_run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session)
):
    excel_bytes = await export_bank_advice_excel(db, payroll_run_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=bank_advice_{payroll_run_id}.xlsx"}
    )
