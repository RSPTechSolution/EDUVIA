"""HR: staff directory and profiles, staff attendance, staff leave, payroll and payslips."""
import calendar
import uuid
from datetime import date

from fastapi import APIRouter, Query, Response

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.core.errors import Forbidden
from app.core.permissions import STAFF_ROLES
from app.schemas.common import ApiResponse, Message, ok
from app.schemas.hr import (
    Adjust, Decision, LeaveTypeIn, LeaveTypeOut, MarkPaid, ProfileIn, RunIn, RunOut, StaffAttendanceSave, StaffDayRow, StaffDetail, StaffLeaveIn,
    StaffLeaveOut, StaffRow,
)
from app.services import hr_service as svc
from app.services import pdf_service

router = APIRouter(dependencies=[require_module("hr")])


def _staff_only(current: CurrentUser) -> None:
    current.require_school()
    if current.role not in STAFF_ROLES and current.role != "driver":
        raise Forbidden("For school staff only", code="PERMISSION_DENIED")


# ---- directory --------------------------------------------------------------------------------

@router.get("/staff", response_model=ApiResponse[list[StaffRow]])
async def staff(db: DB, current: CurrentUser = require_permission("hr.view")):
    current.require_school()
    return ok(await svc.directory(db, current.user))


@router.get("/staff/{user_id}", response_model=ApiResponse[StaffDetail])
async def staff_detail(user_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.detail(db, current.user, user_id))


@router.put("/staff/{user_id}", response_model=ApiResponse[StaffDetail])
async def save_profile(user_id: uuid.UUID, body: ProfileIn, db: DB, current: CurrentUser = require_permission("hr.manage")):
    current.require_school()
    return ok(await svc.save_profile(db, current.user, user_id, body))


# ---- staff attendance -------------------------------------------------------------------------

@router.get("/attendance", response_model=ApiResponse[list[StaffDayRow]])
async def day(db: DB, on: date = Query(alias="date"), current: CurrentUser = require_permission("hr.view")):
    current.require_school()
    return ok(await svc.day_sheet(db, current.user, on))


@router.put("/attendance", response_model=ApiResponse[list[StaffDayRow]])
async def mark(body: StaffAttendanceSave, db: DB, current: CurrentUser = require_permission("hr.manage")):
    current.require_school()
    return ok(await svc.mark_day(db, current.user, body.date, body.records))


@router.post("/attendance/sync", response_model=ApiResponse[dict])
async def sync(db: DB, on: date = Query(alias="date"), current: CurrentUser = require_permission("hr.manage")):
    current.require_school()
    return ok({"updated": await svc.sync_biometric(db, current.user, on)})


@router.get("/my/attendance", response_model=ApiResponse[list[dict]])
async def my_attendance(db: DB, month: str = Query(pattern=r"^\d{4}-\d{2}$"), current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.my_attendance(db, current.user, month))


# ---- leave ------------------------------------------------------------------------------------

@router.get("/leave-types", response_model=ApiResponse[list[LeaveTypeOut]])
async def leave_types(db: DB, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok([LeaveTypeOut(id=t.id, name=t.name, code=t.code, days_per_year=t.days_per_year, paid=t.paid, is_active=t.is_active)
               for t in await svc.leave_types(db, current.user.school_id)])


@router.post("/leave-types", response_model=ApiResponse[LeaveTypeOut], status_code=201)
async def add_leave_type(body: LeaveTypeIn, db: DB, current: CurrentUser = require_permission("hr.manage")):
    current.require_school()
    return ok(await svc.save_leave_type(db, current.user, body))


@router.put("/leave-types/{tid}", response_model=ApiResponse[LeaveTypeOut])
async def edit_leave_type(tid: uuid.UUID, body: LeaveTypeIn, db: DB, current: CurrentUser = require_permission("hr.manage")):
    current.require_school()
    return ok(await svc.save_leave_type(db, current.user, body, tid))


@router.get("/leave", response_model=ApiResponse[list[StaffLeaveOut]])
async def list_leave(db: DB, mine: bool = False, status: str | None = None, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.list_leave(db, current.user, mine, status))


@router.get("/my/leave-balance", response_model=ApiResponse[list[dict]])
async def balance(db: DB, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.balances(db, current.user.school_id, current.user.id))


@router.post("/leave", response_model=ApiResponse[StaffLeaveOut], status_code=201)
async def apply(body: StaffLeaveIn, db: DB, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.apply_leave(db, current.user, body))


@router.post("/leave/{lid}/decide", response_model=ApiResponse[StaffLeaveOut])
async def decide(lid: uuid.UUID, body: Decision, db: DB, current: CurrentUser = require_permission("hr.manage")):
    current.require_school()
    return ok(await svc.decide(db, current.user, lid, body.approve, body.note))


@router.post("/leave/{lid}/cancel", response_model=ApiResponse[StaffLeaveOut])
async def cancel(lid: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.cancel(db, current.user, lid))


# ---- payroll ----------------------------------------------------------------------------------

@router.get("/payroll", response_model=ApiResponse[list[RunOut]])
async def runs(db: DB, current: CurrentUser = require_permission("payroll.view")):
    current.require_school()
    return ok(await svc.runs(db, current.user))


@router.post("/payroll", response_model=ApiResponse[RunOut], status_code=201)
async def generate(body: RunIn, db: DB, current: CurrentUser = require_permission("payroll.manage")):
    current.require_school()
    return ok(await svc.generate(db, current.user, body.month))


@router.get("/payroll/{rid}", response_model=ApiResponse[RunOut])
async def get_run(rid: uuid.UUID, db: DB, current: CurrentUser = require_permission("payroll.view")):
    current.require_school()
    return ok(await svc.get_run(db, current.user, rid))


@router.put("/payroll/{rid}/payslips/{sid}", response_model=ApiResponse[RunOut])
async def adjust(rid: uuid.UUID, sid: uuid.UUID, body: Adjust, db: DB, current: CurrentUser = require_permission("payroll.manage")):
    current.require_school()
    return ok(await svc.adjust(db, current.user, rid, sid, body.adjustments, body.note))


@router.post("/payroll/{rid}/finalise", response_model=ApiResponse[RunOut])
async def finalise(rid: uuid.UUID, db: DB, current: CurrentUser = require_permission("payroll.manage")):
    current.require_school()
    return ok(await svc.finalise(db, current.user, rid))


@router.post("/payroll/{rid}/paid", response_model=ApiResponse[RunOut])
async def paid(rid: uuid.UUID, body: MarkPaid, db: DB, current: CurrentUser = require_permission("payroll.manage")):
    current.require_school()
    return ok(await svc.mark_paid(db, current.user, rid, body.paid_on))


@router.delete("/payroll/{rid}", response_model=ApiResponse[Message])
async def delete_run(rid: uuid.UUID, db: DB, current: CurrentUser = require_permission("payroll.manage")):
    current.require_school()
    await svc.delete_run(db, current.user, rid)
    return ok(Message(message="Payroll deleted"))


@router.get("/payroll/{rid}/bank-advice.csv")
async def bank_advice(rid: uuid.UUID, db: DB, current: CurrentUser = require_permission("payroll.view")):
    current.require_school()
    csv = await svc.bank_advice(db, current.user, rid)
    return Response(csv, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="bank-advice.csv"'})


@router.get("/my/payslips", response_model=ApiResponse[list[dict]])
async def my_payslips(db: DB, current: CurrentUser = require_permission("school.view")):
    _staff_only(current)
    return ok(await svc.my_payslips(db, current.user))


@router.get("/payslips/{sid}/pdf")
async def payslip_pdf(sid: uuid.UUID, db: DB, download: bool = False, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    s, r, staff_user, p, school = await svc.payslip_for_pdf(db, current.user, sid)
    y, m = map(int, r.month.split("-"))
    data = pdf_service.payslip(
        school_name=school.name, school_address=school.address, month_label=f"{calendar.month_name[m]} {y}", name=staff_user.full_name,
        employee_id=staff_user.employee_id, designation=staff_user.designation, department=p.department if p else None, pan=p.pan if p else None,
        uan=p.uan if p else None, bank=p.bank_name if p else None, account=p.bank_account if p else None, days_in_month=s.days_in_month,
        paid_days=s.paid_days, lop_days=s.lop_days, earnings=s.earnings, deductions=s.deductions, gross=s.gross, total_deductions=s.total_deductions,
        net=s.net)
    return pdf_service.pdf_response(data, f"payslip-{r.month}-{(staff_user.employee_id or staff_user.full_name).replace(' ', '-').lower()}.pdf", download)
