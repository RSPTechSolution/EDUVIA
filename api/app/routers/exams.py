"""Exams: date sheets, marks, results and report cards."""
import uuid

from fastapi import APIRouter

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.common import ApiResponse, Message, ok
from app.schemas.exams import (
    ChildResults, ClassPapersSet, ExamDetail, ExamIn, ExamOut, ExamUpdate, FromTimetable, MarksSave, MarksSheet, MarksSheetRef,
    RemarkSet, ReportCard, SectionResults,
)
from app.services import exam_service as svc

router = APIRouter(dependencies=[require_module("exams")])


@router.get("", response_model=ApiResponse[list[ExamOut]])
async def list_exams(db: DB, current: CurrentUser = require_permission("exams.view")):
    return ok(await svc.list_exams(db, current.require_school()))


@router.post("", response_model=ApiResponse[ExamDetail], status_code=201)
async def create_exam(body: ExamIn, db: DB, current: CurrentUser = require_permission("exams.manage")):
    e = await svc.create_exam(db, current.require_school(), body, actor_id=current.id)
    return ok(await svc.exam_detail(db, current.require_school(), e.id))


@router.get("/my", response_model=ApiResponse[list[ChildResults]])
async def mine(db: DB, current: CurrentUser = require_permission("school.view")):
    """Published results for a parent's children or a student, plus upcoming papers."""
    current.require_school()
    return ok(await svc.my_results(db, current.user))


@router.get("/{exam_id}", response_model=ApiResponse[ExamDetail])
async def detail(exam_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.view")):
    return ok(await svc.exam_detail(db, current.require_school(), exam_id))


@router.patch("/{exam_id}", response_model=ApiResponse[ExamDetail])
async def update(exam_id: uuid.UUID, body: ExamUpdate, db: DB, current: CurrentUser = require_permission("exams.manage")):
    await svc.update_exam(db, current.require_school(), exam_id, body, actor_id=current.id)
    return ok(await svc.exam_detail(db, current.require_school(), exam_id))


@router.delete("/{exam_id}", response_model=ApiResponse[Message])
async def delete(exam_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.manage")):
    await svc.delete_exam(db, current.require_school(), exam_id, actor_id=current.id)
    return ok(Message(message="Exam deleted"))


@router.put("/{exam_id}/papers", response_model=ApiResponse[ExamDetail])
async def set_papers(exam_id: uuid.UUID, body: ClassPapersSet, db: DB, current: CurrentUser = require_permission("exams.manage")):
    await svc.set_class_papers(db, current.require_school(), exam_id, body, actor_id=current.id)
    return ok(await svc.exam_detail(db, current.require_school(), exam_id))


@router.post("/{exam_id}/papers/from-timetable", response_model=ApiResponse[dict])
async def from_timetable(exam_id: uuid.UUID, body: FromTimetable, db: DB, current: CurrentUser = require_permission("exams.manage")):
    return ok({"added": await svc.papers_from_timetable(db, current.require_school(), exam_id, body, actor_id=current.id)})


@router.post("/{exam_id}/publish", response_model=ApiResponse[Message])
async def publish(exam_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.manage")):
    await svc.publish(db, current.require_school(), exam_id, True, actor_id=current.id)
    return ok(Message(message="Results published"))


@router.post("/{exam_id}/unpublish", response_model=ApiResponse[Message])
async def unpublish(exam_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.manage")):
    await svc.publish(db, current.require_school(), exam_id, False, actor_id=current.id)
    return ok(Message(message="Results hidden from families"))


@router.get("/{exam_id}/marks-sheets", response_model=ApiResponse[list[MarksSheetRef]])
async def sheets(exam_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.view")):
    """The (class, subject) mark sheets this user can fill in."""
    current.require_school()
    return ok(await svc.marks_sheets(db, current.user, exam_id))


@router.get("/papers/{paper_id}/sections/{section_id}", response_model=ApiResponse[MarksSheet])
async def sheet(paper_id: uuid.UUID, section_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.view")):
    current.require_school()
    return ok(await svc.marks_sheet(db, current.user, paper_id, section_id))


@router.put("/papers/{paper_id}/sections/{section_id}", response_model=ApiResponse[MarksSheet])
async def save(paper_id: uuid.UUID, section_id: uuid.UUID, body: MarksSave, db: DB, current: CurrentUser = require_permission("exams.marks")):
    current.require_school()
    return ok(await svc.save_marks(db, current.user, paper_id, section_id, body))


@router.get("/{exam_id}/results/{section_id}", response_model=ApiResponse[SectionResults])
async def results(exam_id: uuid.UUID, section_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.view")):
    return ok(await svc.section_results(db, current.require_school(), exam_id, section_id))


@router.put("/{exam_id}/remarks/{student_id}", response_model=ApiResponse[Message])
async def remark(exam_id: uuid.UUID, student_id: uuid.UUID, body: RemarkSet, db: DB, current: CurrentUser = require_permission("exams.marks")):
    current.require_school()
    await svc.set_remark(db, current.user, exam_id, student_id, body.remark)
    return ok(Message(message="Remark saved"))


@router.get("/{exam_id}/report/{student_id}", response_model=ApiResponse[ReportCard])
async def report(exam_id: uuid.UUID, student_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    """Staff any time; the student and their parents once results are published."""
    current.require_school()
    return ok(await svc.report_card(db, current.user, exam_id, student_id))
