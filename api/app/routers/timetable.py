"""Subjects, bell schedule, teacher availability and the weekly timetable."""
import uuid

from fastapi import APIRouter, Query

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.common import ApiResponse, Message, ok
from app.schemas.timetable import (
    AvailableTeacher, CopyTimetable, EntryOut, PeriodOut, PeriodsReplace, SlotSet, SubjectCreate, SubjectOut, SubjectUpdate,
    TeacherOut, TeacherSubjectsSet, TimetableView, UnavailabilitySet,
)
from app.services import timetable_service as svc

router = APIRouter(dependencies=[require_module("academics")])


@router.get("/my", response_model=ApiResponse[list[TimetableView]])
async def my_timetables(db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.my_timetables(db, current.user))


# ---- subjects -------------------------------------------------------------------------------

@router.get("/subjects", response_model=ApiResponse[list[SubjectOut]])
async def list_subjects(db: DB, current: CurrentUser = require_permission("timetable.view")):
    return ok(await svc.list_subjects(db, current.require_school()))


@router.post("/subjects", response_model=ApiResponse[SubjectOut], status_code=201)
async def create_subject(body: SubjectCreate, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    return ok(SubjectOut.model_validate(await svc.create_subject(db, current.require_school(), body, actor_id=current.id)))


@router.patch("/subjects/{subject_id}", response_model=ApiResponse[SubjectOut])
async def update_subject(subject_id: uuid.UUID, body: SubjectUpdate, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    return ok(SubjectOut.model_validate(await svc.update_subject(db, current.require_school(), subject_id, body, actor_id=current.id)))


@router.delete("/subjects/{subject_id}", response_model=ApiResponse[Message])
async def delete_subject(subject_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    await svc.delete_subject(db, current.require_school(), subject_id, actor_id=current.id)
    return ok(Message(message="Subject deleted"))


# ---- bell schedule --------------------------------------------------------------------------

@router.get("/periods", response_model=ApiResponse[list[PeriodOut]])
async def list_periods(db: DB, current: CurrentUser = require_permission("school.view")):
    return ok([PeriodOut.model_validate(p) for p in await svc.list_periods(db, current.require_school())])


@router.put("/periods", response_model=ApiResponse[list[PeriodOut]])
async def replace_periods(body: PeriodsReplace, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    periods = await svc.replace_periods(db, current.require_school(), body, actor_id=current.id)
    return ok([PeriodOut.model_validate(p) for p in periods])


# ---- teachers -------------------------------------------------------------------------------

@router.get("/teachers", response_model=ApiResponse[list[TeacherOut]])
async def list_teachers(db: DB, current: CurrentUser = require_permission("timetable.view")):
    return ok(await svc.list_teachers(db, current.require_school()))


@router.put("/teachers/{teacher_id}/subjects", response_model=ApiResponse[Message])
async def set_subjects(teacher_id: uuid.UUID, body: TeacherSubjectsSet, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    await svc.set_teacher_subjects(db, current.require_school(), teacher_id, body.subject_ids, actor_id=current.id)
    return ok(Message(message="Subjects saved"))


@router.put("/teachers/{teacher_id}/unavailability", response_model=ApiResponse[Message])
async def set_unavailability(teacher_id: uuid.UUID, body: UnavailabilitySet, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    await svc.set_unavailability(db, current.require_school(), teacher_id, body.slots, actor_id=current.id)
    return ok(Message(message="Availability saved"))


@router.get("/teachers/{teacher_id}", response_model=ApiResponse[TimetableView])
async def teacher_timetable(teacher_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("timetable.view")):
    return ok(await svc.teacher_timetable(db, current.require_school(), teacher_id))


@router.get("/available-teachers", response_model=ApiResponse[list[AvailableTeacher]])
async def available_teachers(
    db: DB, day: int = Query(ge=1, le=6), period_id: uuid.UUID = Query(),
    subject_id: uuid.UUID | None = None, section_id: uuid.UUID | None = None,
    current: CurrentUser = require_permission("timetable.view"),
):
    return ok(await svc.available_teachers(db, current.require_school(), day=day, period_id=period_id,
                                           subject_id=subject_id, section_id=section_id))


# ---- sections -------------------------------------------------------------------------------

@router.get("/sections/{section_id}", response_model=ApiResponse[TimetableView])
async def section_timetable(section_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("timetable.view")):
    return ok(await svc.section_timetable(db, current.require_school(), section_id))


@router.put("/slots", response_model=ApiResponse[EntryOut])
async def set_slot(body: SlotSet, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    return ok(await svc.set_slot(db, current.require_school(), body, actor_id=current.id))


@router.delete("/slots", response_model=ApiResponse[Message])
async def clear_slot(db: DB, section_id: uuid.UUID, day: int = Query(ge=1, le=6), period_id: uuid.UUID = Query(),
                     current: CurrentUser = require_permission("timetable.manage")):
    await svc.clear_slot(db, current.require_school(), section_id, day, period_id, actor_id=current.id)
    return ok(Message(message="Slot cleared"))


@router.post("/sections/{section_id}/copy", response_model=ApiResponse[dict])
async def copy_timetable(section_id: uuid.UUID, body: CopyTimetable, db: DB, current: CurrentUser = require_permission("timetable.manage")):
    return ok(await svc.copy_timetable(db, current.require_school(), section_id, body, actor_id=current.id))
