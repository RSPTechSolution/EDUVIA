"""Question bank and online tests, co-scholastic grades, live classes."""
import uuid

from fastapi import APIRouter, Body

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.common import ApiResponse, Message, ok
from app.schemas.online import (
    AnswersSave, AreaIn, AreaOut, AttemptResult, AttemptView, CoSave, CoSheet, LiveIn, LiveOut, MarkShort, MyTest, QuestionIn,
    QuestionOut, TestIn, TestOut, TestResults,
)
from app.services import co_live_service as co
from app.services import online_test_service as svc

questions = APIRouter(dependencies=[require_module("exams")])
tests = APIRouter(dependencies=[require_module("exams")])
co_scholastic = APIRouter(dependencies=[require_module("exams")])
live = APIRouter(dependencies=[require_module("academics")])


# ---- question bank ----------------------------------------------------------------------------

@questions.get("", response_model=ApiResponse[list[QuestionOut]])
async def list_questions(class_id: uuid.UUID, db: DB, subject_id: uuid.UUID | None = None, search: str | None = None,
                         current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.list_questions(db, current.user, class_id, subject_id, search))


@questions.post("", response_model=ApiResponse[QuestionOut], status_code=201)
async def add_question(body: QuestionIn, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.create_question(db, current.user, body))


@questions.put("/{question_id}", response_model=ApiResponse[QuestionOut])
async def edit_question(question_id: uuid.UUID, body: QuestionIn, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.update_question(db, current.user, question_id, body))


@questions.delete("/{question_id}", response_model=ApiResponse[Message])
async def delete_question(question_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    await svc.delete_question(db, current.user, question_id)
    return ok(Message(message="Question removed"))


# ---- tests (families) -------------------------------------------------------------------------

@tests.get("/my", response_model=ApiResponse[list[MyTest]])
async def my_tests(db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.my_tests(db, current.user))


@tests.post("/{test_id}/start", response_model=ApiResponse[AttemptView])
async def start(test_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.start(db, current.user, test_id))


@tests.put("/{test_id}/answers", response_model=ApiResponse[dict])
async def save(test_id: uuid.UUID, body: AnswersSave, db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.save_answers(db, current.user, test_id, body.answers))


@tests.post("/{test_id}/submit", response_model=ApiResponse[AttemptResult])
async def submit(test_id: uuid.UUID, db: DB, body: AnswersSave | None = Body(None), current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.submit(db, current.user, test_id, body.answers if body else None))


@tests.get("/{test_id}/result/{student_id}", response_model=ApiResponse[AttemptResult])
async def result(test_id: uuid.UUID, student_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.result(db, current.user, test_id, student_id))


# ---- tests (teachers) -------------------------------------------------------------------------

@tests.get("", response_model=ApiResponse[list[TestOut]])
async def list_tests(db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.list_tests(db, current.user))


@tests.post("", response_model=ApiResponse[TestOut], status_code=201)
async def create_test(body: TestIn, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.create_test(db, current.user, body))


@tests.put("/{test_id}", response_model=ApiResponse[TestOut])
async def update_test(test_id: uuid.UUID, body: TestIn, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.update_test(db, current.user, test_id, body))


@tests.post("/{test_id}/publish", response_model=ApiResponse[TestOut])
async def publish(test_id: uuid.UUID, db: DB, on: bool = True, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.publish(db, current.user, test_id, on))


@tests.delete("/{test_id}", response_model=ApiResponse[Message])
async def delete_test(test_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    await svc.delete_test(db, current.user, test_id)
    return ok(Message(message="Test deleted"))


@tests.get("/{test_id}/results", response_model=ApiResponse[TestResults])
async def results(test_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.results(db, current.user, test_id))


@tests.put("/{test_id}/marks/{student_id}", response_model=ApiResponse[AttemptResult])
async def mark(test_id: uuid.UUID, student_id: uuid.UUID, body: MarkShort, db: DB, current: CurrentUser = require_permission("tests.manage")):
    current.require_school()
    return ok(await svc.mark_short(db, current.user, test_id, student_id, body.marks))


# ---- co-scholastic ----------------------------------------------------------------------------

@co_scholastic.get("/areas", response_model=ApiResponse[list[AreaOut]])
async def areas(db: DB, current: CurrentUser = require_permission("exams.view")):
    current.require_school()
    return ok([AreaOut(id=a.id, name=a.name, sort_order=a.sort_order) for a in await co.areas(db, current.user.school_id)])


@co_scholastic.post("/areas", response_model=ApiResponse[AreaOut], status_code=201)
async def add_area(body: AreaIn, db: DB, current: CurrentUser = require_permission("exams.manage")):
    current.require_school()
    return ok(await co.add_area(db, current.user, body.name))


@co_scholastic.delete("/areas/{area_id}", response_model=ApiResponse[Message])
async def delete_area(area_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.manage")):
    current.require_school()
    await co.delete_area(db, current.user, area_id)
    return ok(Message(message="Area removed"))


@co_scholastic.get("/{exam_id}/{section_id}", response_model=ApiResponse[CoSheet])
async def sheet(exam_id: uuid.UUID, section_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("exams.view")):
    current.require_school()
    return ok(await co.sheet(db, current.user, exam_id, section_id))


@co_scholastic.put("/{exam_id}/{section_id}", response_model=ApiResponse[CoSheet])
async def save_sheet(exam_id: uuid.UUID, section_id: uuid.UUID, body: CoSave, db: DB, current: CurrentUser = require_permission("exams.view")):
    current.require_school()
    return ok(await co.save_sheet(db, current.user, exam_id, section_id, body))


# ---- live classes -----------------------------------------------------------------------------

@live.get("", response_model=ApiResponse[list[LiveOut]])
async def list_live(db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await co.list_live(db, current.user))


@live.post("", response_model=ApiResponse[LiveOut], status_code=201)
async def create_live(body: LiveIn, db: DB, current: CurrentUser = require_permission("live.manage")):
    current.require_school()
    return ok(await co.create_live(db, current.user, body))


@live.put("/{live_id}", response_model=ApiResponse[LiveOut])
async def update_live(live_id: uuid.UUID, body: LiveIn, db: DB, current: CurrentUser = require_permission("live.manage")):
    current.require_school()
    return ok(await co.update_live(db, current.user, live_id, body))


@live.post("/{live_id}/cancel", response_model=ApiResponse[LiveOut])
async def cancel_live(live_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("live.manage")):
    current.require_school()
    return ok(await co.cancel_live(db, current.user, live_id))
