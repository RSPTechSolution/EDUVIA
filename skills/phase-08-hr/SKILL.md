---
name: schoolerp-phase-08-hr
description: >
  Phase 8 of SchoolERP (Python + Flutter) — staff profiles, leave types and
  multi-level approval workflow, payroll auto-calculation with daily rate
  pro-ration, WeasyPrint salary slip PDF, Excel bank advice via openpyxl.
---
# Phase 8 — HR & Payroll
## Python FastAPI · Celery · Flutter

## Key Models + Service Logic

```python
# api/app/models/hr.py
class LeaveApplication(Base):
    __tablename__ = "leave_applications"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column()
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class SalaryStructure(Base):
    __tablename__ = "salary_structures"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    basic: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    hra: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    ta: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    da: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    pf: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    esi: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tds: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    effective_from: Mapped[date] = mapped_column(Date)

class PayrollRun(Base):
    __tablename__ = "payroll_runs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    month: Mapped[int] = mapped_column()
    year: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="draft")
    run_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("school_id", "month", "year"),)

class SalarySlip(Base):
    __tablename__ = "salary_slips"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    present_days: Mapped[int] = mapped_column()
    absent_days: Mapped[int] = mapped_column()
    leave_days: Mapped[int] = mapped_column()
    breakdown: Mapped[dict] = mapped_column(JSONB)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

## Payroll Calculation Service

```python
# api/app/services/payroll_service.py
from calendar import monthrange
from decimal import Decimal

async def calculate_slip(db: AsyncSession, staff_id: uuid.UUID, month: int, year: int) -> dict:
    structure = await get_active_salary_structure(db, staff_id, date(year, month, 1))
    _, total_days = monthrange(year, month)
    working_days = await get_working_days(db, month, year)  # excludes holidays/Sundays per school
    attendance = await get_monthly_staff_attendance(db, staff_id, month, year)
    approved_leaves = await get_approved_leaves(db, staff_id, month, year)

    paid_leave_days = sum(l.days for l in approved_leaves if l.leave_type.is_paid)
    present_days = attendance.present_days + paid_leave_days
    absent_days = working_days - present_days

    daily_rate = structure.basic / Decimal(working_days)
    earned_basic = daily_rate * Decimal(present_days)
    gross = earned_basic + structure.hra + structure.ta + structure.da
    deductions = structure.pf + structure.esi + structure.tds
    net = gross - deductions

    return {
        "gross_salary": round(gross, 2), "deductions": round(deductions, 2), "net_salary": round(net, 2),
        "present_days": present_days, "absent_days": absent_days, "leave_days": paid_leave_days,
        "breakdown": {
            "basic": float(earned_basic), "hra": float(structure.hra), "ta": float(structure.ta),
            "da": float(structure.da), "pf": float(structure.pf), "esi": float(structure.esi),
            "tds": float(structure.tds),
        },
    }

# Celery task: bulk payroll for all staff
@shared_task
def run_payroll_for_school(payroll_run_id: str, school_id: str):
    import asyncio
    asyncio.run(_bulk_payroll(payroll_run_id, school_id))

async def _bulk_payroll(payroll_run_id: str, school_id: str):
    async with AsyncSessionLocal() as db:
        all_staff = await get_active_staff(db, uuid.UUID(school_id))
        run = await db.get(PayrollRun, uuid.UUID(payroll_run_id))
        slips = []
        for staff in all_staff:
            slip_data = await calculate_slip(db, staff.id, run.month, run.year)
            # Generate PDF
            pdf = await generate_salary_slip_pdf(staff, run, slip_data)
            pdf_url = await upload_to_minio(pdf, f"payroll/{payroll_run_id}/{staff.id}.pdf", uuid.UUID(school_id))
            slip = SalarySlip(payroll_run_id=run.id, staff_id=staff.id, pdf_url=pdf_url, **slip_data)
            slips.append(slip)
        db.add_all(slips)
        run.status = "generated"
        await db.commit()
```

## Bank Advice Excel Export

```python
# api/app/services/hr_service.py
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

async def export_bank_advice_excel(db: AsyncSession, payroll_run_id: uuid.UUID) -> bytes:
    slips = await get_slips_with_staff(db, payroll_run_id)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Bank Transfer Advice"

    # Header row
    headers = ["S.No", "Staff Name", "Employee ID", "Bank", "Account No", "IFSC Code", "Net Salary"]
    header_fill = PatternFill("solid", fgColor="1A3C5E")
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    # Data rows
    for i, slip in enumerate(slips, 2):
        ws.append([
            i - 1, f"{slip.staff.first_name} {slip.staff.last_name}",
            slip.staff.employee_id, slip.staff.bank_name,
            slip.staff.account_no, slip.staff.ifsc_code, float(slip.net_salary),
        ])

    # Auto-width
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(c.value or "")) for c in col) + 4

    from io import BytesIO
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
```

## Flutter — HR Screens

```dart
// lib/features/hr/screens/leave_application_screen.dart
// Form: leave type dropdown, start date, end date, reason text
// Shows leave balance per type
// Submit → POST /api/v1/hr/leave/apply
// Status tracking: pending (yellow), approved (green), rejected (red)

// lib/features/hr/screens/salary_slip_screen.dart
// Shows monthly salary breakdown as cards:
//   Earnings: Basic, HRA, TA, DA
//   Deductions: PF, ESI, TDS
//   Net Salary (large, highlighted)
// Download PDF button → open_filex to view PDF
```

## Testing — Phase 8

```python
def test_payroll_calculation_net_salary():
    structure = MockStructure(basic=30000, hra=5000, ta=2000, da=1000, pf=1800, esi=450, tds=2000)
    # 26 working days, 24 present
    result = calculate_slip_sync(structure, working_days=26, present_days=24)
    earned_basic = 30000 / 26 * 24  # 27692.31
    gross = earned_basic + 5000 + 2000 + 1000  # 35692.31
    net = gross - (1800 + 450 + 2000)  # 31442.31
    assert abs(float(result["net_salary"]) - net) < 0.1

def test_payroll_deducts_absent_days():
    # Full month 26 days, 5 absent → proportional deduction
    result = calculate_slip_sync(structure, working_days=26, present_days=21)
    earned_basic = 30000 / 26 * 21
    assert float(result["breakdown"]["basic"]) == pytest.approx(earned_basic, rel=0.01)

@pytest.mark.asyncio
async def test_bank_advice_excel_valid(auth_client):
    res = await auth_client.get(f"/api/v1/hr/payroll/{PAYROLL_RUN_ID}/bank-advice")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
```

## Antigravity Prompt for Phase 8

```
@file skills/master-plan/SKILL.md
@file skills/phase-08-hr/SKILL.md

Build Phase 8 — HR & Payroll:
1. SQLAlchemy models (Staff, LeaveType, LeaveApplication, SalaryStructure, PayrollRun, SalarySlip) + migration
2. Staff CRUD with MinIO document upload (ID proof, certificates)
3. Leave management: application → multi-level approval → balance tracking
4. Payroll calculator: daily rate pro-ration, allowances, deductions function
5. Celery task: bulk payroll run for all staff in school
6. WeasyPrint salary slip PDF template (Jinja2)
7. openpyxl bank advice Excel export with styled headers
8. Flutter leave application screen: type picker, date range, balance display
9. Flutter payroll screen (admin): payroll run trigger, slip list with PDF download
10. Flutter salary slip screen (staff): breakdown cards, download button (open_filex)
11. All tests: pytest (calculation accuracy, absent-day deduction, Excel output) + flutter_test
```
