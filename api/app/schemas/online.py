"""Question bank, online tests and attempts, co-scholastic grades, live classes."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints, model_validator

Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
QText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
Kind = Literal["single", "multiple", "true_false", "short"]


class OptionIn(BaseModel):
    id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8)]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class QuestionIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    kind: Kind
    text: QText
    options: list[OptionIn] = Field(default_factory=list, max_length=8)
    answer: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]] = Field(default_factory=list, max_length=8)
    marks: Annotated[Decimal, Field(gt=0, le=100, decimal_places=2)] = Decimal(1)
    explanation: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    topic: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"

    @model_validator(mode="after")
    def _shape(self):
        if self.kind == "true_false":
            self.options = [OptionIn(id="t", text="True"), OptionIn(id="f", text="False")]
        if self.kind == "short":
            self.options = []
            return self
        if not self.answer:
            raise ValueError("answer: Mark the correct answer")
        ids = [o.id for o in self.options]
        if len(ids) < 2:
            raise ValueError("options: Give at least two options")
        if len(set(ids)) != len(ids):
            raise ValueError("options: Each option needs its own id")
        if not set(self.answer) <= set(ids):
            raise ValueError("answer: The answer must be one of the options")
        if self.kind in ("single", "true_false") and len(self.answer) != 1:
            raise ValueError("answer: Choose exactly one correct option")
        return self


class QuestionOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    subject_id: uuid.UUID
    subject_name: str
    kind: str
    text: str
    options: list[dict]
    answer: list[str]
    marks: Num
    explanation: str | None
    topic: str | None
    difficulty: str
    used_in: int = 0
    can_edit: bool = True


class TestIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    instructions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    class_id: uuid.UUID
    subject_id: uuid.UUID
    section_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)
    question_ids: list[uuid.UUID] = Field(min_length=1, max_length=200)
    opens_at: datetime
    closes_at: datetime
    duration_minutes: int = Field(ge=1, le=300)
    shuffle: bool = True
    show_results: Literal["after_submit", "after_close", "never"] = "after_close"

    @model_validator(mode="after")
    def _window(self):
        if self.closes_at <= self.opens_at:
            raise ValueError("closes_at: The test must close after it opens")
        if len(set(self.question_ids)) != len(self.question_ids):
            raise ValueError("question_ids: A question is listed twice")
        return self


class TestOut(BaseModel):
    id: uuid.UUID
    title: str
    instructions: str | None
    class_id: uuid.UUID
    subject_id: uuid.UUID
    subject_name: str
    section_ids: list[uuid.UUID]
    sections_label: str
    question_ids: list[uuid.UUID]
    questions: int
    max_marks: Num
    opens_at: datetime
    closes_at: datetime
    duration_minutes: int
    shuffle: bool
    show_results: str
    published: bool
    status: str  # draft | upcoming | open | closed
    attempts: int = 0
    submitted: int = 0
    average: float | None = None
    can_edit: bool = True


class PaperQuestion(BaseModel):
    """A question as the student sees it: no answer."""
    id: uuid.UUID
    kind: str
    text: str
    options: list[dict]
    marks: Num


class AttemptView(BaseModel):
    test_id: uuid.UUID
    title: str
    instructions: str | None
    subject_name: str
    deadline: datetime
    submitted: bool
    questions: list[PaperQuestion]
    answers: dict[str, list[str] | str]


class AnswersSave(BaseModel):
    answers: dict[str, list[Annotated[str, StringConstraints(max_length=200)]] | Annotated[str, StringConstraints(max_length=2000)]]


class ResultQuestion(BaseModel):
    id: uuid.UUID
    kind: str
    text: str
    options: list[dict]
    marks: Num
    your_answer: list[str] | str | None
    correct: list[str] | None
    awarded: Num | None
    explanation: str | None


class AttemptResult(BaseModel):
    test_id: uuid.UUID
    title: str
    student_id: uuid.UUID
    student_name: str
    submitted_at: datetime | None
    score: Num | None
    max_marks: Num
    percent: float | None
    needs_marking: bool
    released: bool  # whether answers and marks may be shown to the family
    questions: list[ResultQuestion] = []


class MyTest(BaseModel):
    test_id: uuid.UUID
    title: str
    subject_name: str
    student_id: uuid.UUID
    student_name: str
    opens_at: datetime
    closes_at: datetime
    duration_minutes: int
    questions: int
    max_marks: Num
    state: str  # upcoming | open | in_progress | submitted | missed
    score: Num | None
    percent: float | None
    released: bool


class AttemptRow(BaseModel):
    attempt_id: uuid.UUID | None
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    section_label: str
    state: str  # not_started | in_progress | submitted
    score: Num | None
    percent: float | None
    needs_marking: bool
    submitted_at: datetime | None


class QuestionStat(BaseModel):
    question_id: uuid.UUID
    text: str
    kind: str
    correct_percent: float | None
    answered: int


class TestResults(BaseModel):
    test: TestOut
    rows: list[AttemptRow]
    questions: list[QuestionStat]


class MarkShort(BaseModel):
    marks: dict[uuid.UUID, Annotated[Decimal, Field(ge=0, le=100, decimal_places=2)]]


# ---- co-scholastic ----------------------------------------------------------------------------

Grade = Literal["A", "B", "C"]


class AreaIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class AreaOut(BaseModel):
    id: uuid.UUID
    name: str
    sort_order: int


class CoSheetRow(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    grades: dict[str, str]  # area id -> grade


class CoSheet(BaseModel):
    exam_id: uuid.UUID
    section_id: uuid.UUID
    label: str
    areas: list[AreaOut]
    rows: list[CoSheetRow]
    editable: bool


class CoSave(BaseModel):
    grades: dict[uuid.UUID, dict[uuid.UUID, Grade | None]]  # student -> area -> grade


# ---- live classes -----------------------------------------------------------------------------

class LiveIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    section_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)
    subject_id: uuid.UUID | None = None
    starts_at: datetime
    duration_minutes: int = Field(40, ge=10, le=240)
    meeting_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https://")] | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


class LiveOut(BaseModel):
    id: uuid.UUID
    title: str
    section_ids: list[uuid.UUID]
    sections_label: str
    subject_name: str | None
    subject_color: str | None
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int
    meeting_url: str
    provider: str  # Google Meet | Zoom | Jitsi | Microsoft Teams | Link
    notes: str | None
    teacher: str | None
    cancelled: bool
    state: str  # upcoming | live | ended | cancelled
    can_edit: bool = False
