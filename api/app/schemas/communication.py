import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]


# ---- notices ----------------------------------------------------------------------------------

class NoticeIn(BaseModel):
    title: Title
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    audience: Literal["everyone", "staff", "families", "sections"]
    section_ids: list[uuid.UUID] = Field(default_factory=list, max_length=60)
    priority: Literal["normal", "important", "urgent"] = "normal"
    pinned: bool = False

    @model_validator(mode="after")
    def _sections(self):
        if self.audience == "sections" and not self.section_ids:
            raise ValueError("Choose at least one class")
        if self.audience != "sections":
            self.section_ids = []
        return self


class NoticeOut(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    audience: str
    audience_label: str
    section_ids: list[uuid.UUID]
    priority: str
    pinned: bool
    created_at: datetime
    author: str | None
    read: bool
    can_edit: bool
    reads: int | None = None  # for the author and managers
    recipients: int | None = None


# ---- homework ---------------------------------------------------------------------------------

class HomeworkIn(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    title: Title
    details: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] | None = None
    due_date: date


class HomeworkUpdate(BaseModel):
    title: Title | None = None
    details: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] | None = None
    due_date: date | None = None


class HomeworkOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    section_label: str
    subject_id: uuid.UUID
    subject_name: str
    subject_color: str
    title: str
    details: str | None
    assigned_on: date
    due_date: date
    teacher: str | None
    students: int = 0
    done: int = 0
    checked: int = 0
    can_edit: bool = False


class HomeworkStudent(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    status: Literal["pending", "done", "checked", "incomplete"]
    note: str | None
    remark: str | None


class HomeworkDetail(HomeworkOut):
    roster: list[HomeworkStudent]


class CheckEntry(BaseModel):
    student_id: uuid.UUID
    status: Literal["pending", "checked", "incomplete"]
    remark: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class CheckSave(BaseModel):
    entries: list[CheckEntry] = Field(min_length=1, max_length=200)


class FamilyDone(BaseModel):
    student_id: uuid.UUID
    done: bool = True
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class AssignTarget(BaseModel):
    section_id: uuid.UUID
    section_label: str
    subjects: list[dict]  # [{id, name, color}]


class MyHomework(HomeworkOut):
    student_id: uuid.UUID
    student_name: str
    status: Literal["pending", "done", "checked", "incomplete"]
    note: str | None
    remark: str | None
    overdue: bool
