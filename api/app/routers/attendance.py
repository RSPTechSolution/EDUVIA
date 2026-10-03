"""Daily attendance."""
import uuid
from datetime import date

from fastapi import APIRouter

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.attendance import MarkRequest, Overview, Roster, SectionCard, SectionReport, StudentAttendance
from app.schemas.common import ApiResponse, ok
from app.services import attendance_service as svc
from app.services.family_service import own_students, school_today, visible_student

router = APIRouter(dependencies=[require_module("attendance")])


async def _day(db, current: CurrentUser, value: date | None) -> date:
    return value or await school_today(db, current.require_school())


async def _month(db, current: CurrentUser, value: str | None) -> str:
    return value or (await school_today(db, current.require_school())).strftime("%Y-%m")


@router.get("/sections", response_model=ApiResponse[list[SectionCard]])
async def sections(db: DB, date: date | None = None, current: CurrentUser = require_permission("attendance.view")):
    """Sections this user can take attendance for, with how far marking has got on the day."""
    return ok(await svc.list_sections(db, current.user, await _day(db, current, date)))


@router.get("/sections/{section_id}", response_model=ApiResponse[Roster])
async def roster(section_id: uuid.UUID, db: DB, date: date | None = None, current: CurrentUser = require_permission("attendance.view")):
    return ok(await svc.roster(db, current.user, section_id, await _day(db, current, date)))


@router.put("/sections/{section_id}", response_model=ApiResponse[Roster])
async def mark(section_id: uuid.UUID, body: MarkRequest, db: DB, current: CurrentUser = require_permission("attendance.mark")):
    return ok(await svc.mark(db, current.user, section_id, body))


@router.get("/sections/{section_id}/report", response_model=ApiResponse[SectionReport])
async def report(section_id: uuid.UUID, db: DB, month: str | None = None, current: CurrentUser = require_permission("attendance.view")):
    return ok(await svc.section_report(db, current.user, section_id, await _month(db, current, month)))


@router.get("/overview", response_model=ApiResponse[Overview])
async def overview(db: DB, date: date | None = None, current: CurrentUser = require_permission("attendance.view")):
    return ok(await svc.overview(db, current.user, await _day(db, current, date)))


@router.get("/students/{student_id}", response_model=ApiResponse[StudentAttendance])
async def student(student_id: uuid.UUID, db: DB, month: str | None = None, current: CurrentUser = require_permission("school.view")):
    """A student's month: staff with attendance.view, the student, or their parents."""
    s = await visible_student(db, current.user, student_id, "attendance.view")
    return ok(await svc.student_attendance(db, s, await _month(db, current, month)))


@router.get("/my", response_model=ApiResponse[list[StudentAttendance]])
async def mine(db: DB, month: str | None = None, current: CurrentUser = require_permission("school.view")):
    """A parent's children, or a student's own attendance, for one month."""
    m = await _month(db, current, month)
    return ok([await svc.student_attendance(db, s, m) for s in await own_students(db, current.user)])
