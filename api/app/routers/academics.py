"""Classes & sections, and student records."""
import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.academics import (
    ClassBulkCreate, ClassCreate, ClassOut, ClassUpdate, GuardianAdd, SectionCreate, SectionOut, SectionUpdate,
    StudentCreate, StudentCreated, StudentDetail, StudentOption, StudentOut, StudentUpdate,
)
from app.schemas.common import ApiResponse, Message, PageParams, ok
from app.schemas.accounts import ReminderResult
from app.schemas.class_teacher import ClassReminderIn, MyClass, MyClassDetail
from app.schemas.profile import StudentOverview
from app.services import academics_service, class_teacher_service, student_service

classes = APIRouter(dependencies=[require_module("students")])
students = APIRouter(dependencies=[require_module("students")])


# ---- classes & sections -------------------------------------------------------------------

@classes.get("", response_model=ApiResponse[list[ClassOut]])
async def list_classes(db: DB, current: CurrentUser = require_permission("students.view")):
    return ok(await academics_service.list_classes(db, current.require_school()))


@classes.get("/my", response_model=ApiResponse[list[MyClass]])
async def my_classes(db: DB, current: CurrentUser = require_permission("attendance.mark")):
    """The classes this teacher is incharge of (admins: every class), with today's attendance, pending requests and overdue fees."""
    current.require_school()
    return ok(await class_teacher_service.my_classes(db, current.user))


@classes.get("/my/{section_id}", response_model=ApiResponse[MyClassDetail])
async def my_class(section_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("attendance.mark")):
    current.require_school()
    return ok(await class_teacher_service.class_detail(db, current.user, section_id))


@classes.post("/my/{section_id}/fee-reminders", response_model=ApiResponse[ReminderResult])
async def my_class_fee_reminders(section_id: uuid.UUID, body: ClassReminderIn, db: DB, current: CurrentUser = require_permission("attendance.mark")):
    """The incharge reminds their own class's parents about fees due."""
    current.require_school()
    return ok(await class_teacher_service.remind_fees(db, current.user, section_id, body.overdue_only))


@classes.post("", response_model=ApiResponse[ClassOut], status_code=201)
async def create_class(body: ClassCreate, db: DB, current: CurrentUser = require_permission("classes.manage")):
    school_id = current.require_school()
    c = await academics_service.create_class(db, school_id, body, actor_id=current.id)
    return ok(next(x for x in await academics_service.list_classes(db, school_id) if x.id == c.id))


@classes.post("/bulk", response_model=ApiResponse[dict])
async def create_classes(body: ClassBulkCreate, db: DB, current: CurrentUser = require_permission("classes.manage")):
    n = await academics_service.create_classes(db, current.require_school(), body.names,
                                               ClassCreate(name="x", sections=body.sections).sections, actor_id=current.id)
    return ok({"created": n})


@classes.patch("/{class_id}", response_model=ApiResponse[Message])
async def update_class(class_id: uuid.UUID, body: ClassUpdate, db: DB, current: CurrentUser = require_permission("classes.manage")):
    await academics_service.update_class(db, current.require_school(), class_id, body, actor_id=current.id)
    return ok(Message(message="Class updated"))


@classes.delete("/{class_id}", response_model=ApiResponse[Message])
async def delete_class(class_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("classes.manage")):
    await academics_service.delete_class(db, current.require_school(), class_id, actor_id=current.id)
    return ok(Message(message="Class deleted"))


@classes.post("/{class_id}/sections", response_model=ApiResponse[SectionOut], status_code=201)
async def add_section(class_id: uuid.UUID, body: SectionCreate, db: DB, current: CurrentUser = require_permission("classes.manage")):
    s = await academics_service.add_section(db, current.require_school(), class_id, body, actor_id=current.id)
    return ok(SectionOut.model_validate(s))


@classes.patch("/sections/{section_id}", response_model=ApiResponse[SectionOut])
async def update_section(section_id: uuid.UUID, body: SectionUpdate, db: DB, current: CurrentUser = require_permission("classes.manage")):
    s = await academics_service.update_section(db, current.require_school(), section_id, body, actor_id=current.id)
    return ok(SectionOut.model_validate(s))


@classes.delete("/sections/{section_id}", response_model=ApiResponse[Message])
async def delete_section(section_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("classes.manage")):
    await academics_service.delete_section(db, current.require_school(), section_id, actor_id=current.id)
    return ok(Message(message="Section deleted"))


# ---- students ------------------------------------------------------------------------------

@students.get("", response_model=ApiResponse[list[StudentOut]])
async def list_students(db: DB, page: PageParams = Depends(), search: str | None = Query(None, max_length=100),
                        class_id: uuid.UUID | None = None, section_id: uuid.UUID | None = None,
                        status: str | None = Query(None, pattern="^(active|inactive|alumni)$"),
                        current: CurrentUser = require_permission("students.view")):
    rows, meta = await student_service.list_students(db, current.require_school(), page, search=search,
                                                     class_id=class_id, section_id=section_id, status=status)
    return ok(rows, meta)


@students.get("/options", response_model=ApiResponse[list[StudentOption]])
async def student_options(db: DB, search: str | None = Query(None, max_length=100), without_login: bool = False,
                          current: CurrentUser = require_permission("students.view")):
    return ok(await student_service.options(db, current.require_school(), search, without_login=without_login))


@students.post("", response_model=ApiResponse[StudentCreated], status_code=201)
async def create_student(body: StudentCreate, db: DB, current: CurrentUser = require_permission("students.manage")):
    school_id = current.require_school()
    student, passwords = await student_service.create_student(db, school_id, body, actor_id=current.id)
    return ok(StudentCreated(student=await student_service.detail(db, school_id, student.id), new_parent_passwords=passwords))


@students.get("/{student_id}", response_model=ApiResponse[StudentDetail])
async def get_student(student_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("students.view")):
    return ok(await student_service.detail(db, current.require_school(), student_id))


@students.get("/{student_id}/overview", response_model=ApiResponse[StudentOverview])
async def student_overview(student_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("students.view")):
    """Everything about the student from the other modules: library, bus, hostel, results, homework, requests..."""
    from app.services import profile_service
    return ok(await profile_service.student_overview(db, current.require_school(), student_id))


@students.patch("/{student_id}", response_model=ApiResponse[StudentDetail])
async def update_student(student_id: uuid.UUID, body: StudentUpdate, db: DB, current: CurrentUser = require_permission("students.manage")):
    school_id = current.require_school()
    await student_service.update_student(db, school_id, student_id, body, actor_id=current.id)
    return ok(await student_service.detail(db, school_id, student_id))


@students.post("/{student_id}/guardians", response_model=ApiResponse[dict], status_code=201)
async def add_guardian(student_id: uuid.UUID, body: GuardianAdd, db: DB, current: CurrentUser = require_permission("students.manage")):
    school_id = current.require_school()
    pw = await student_service.add_guardian(db, school_id, student_id, body, actor_id=current.id)
    return ok({"student": await student_service.detail(db, school_id, student_id), "temporary_password": pw})


@students.delete("/{student_id}/guardians/{user_id}", response_model=ApiResponse[Message])
async def remove_guardian(student_id: uuid.UUID, user_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("students.manage")):
    await student_service.remove_guardian(db, current.require_school(), student_id, user_id, actor_id=current.id)
    return ok(Message(message="Parent unlinked"))
