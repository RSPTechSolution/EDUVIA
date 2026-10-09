"""SMS/WhatsApp settings, chat, parent-teacher meetings, surveys."""
import uuid
from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Day = date
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


# ---- SMS / WhatsApp ---------------------------------------------------------------------------

class MessagingSettings(BaseModel):
    events: dict[str, list[Literal["sms", "whatsapp"]]] = Field(default_factory=dict)


class MessagingStatus(BaseModel):
    sms_provider: str
    whatsapp_provider: str
    events: dict[str, str]  # event -> label
    chosen: dict[str, list[str]]
    today: dict[str, int]


class MessageOut(BaseModel):
    id: uuid.UUID
    channel: str
    to: str
    body: str
    kind: str
    status: str
    error: str | None
    created_at: datetime


class TestMessage(BaseModel):
    channel: Literal["sms", "whatsapp"]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=20)]


# ---- chat -------------------------------------------------------------------------------------

class Contact(BaseModel):
    """Someone this user may start a conversation with, about a particular student."""
    student_id: uuid.UUID
    student_name: str
    user_id: uuid.UUID
    name: str
    role: str  # "Class teacher" / "Mathematics teacher" / "Father" ...


class ConversationIn(BaseModel):
    student_id: uuid.UUID
    user_id: uuid.UUID  # the other person
    body: Body


class ConversationOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    other_id: uuid.UUID
    other_name: str
    other_role: str
    last_message: str | None
    last_message_at: datetime | None
    unread: int


class MessageIn(BaseModel):
    body: Body


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    mine: bool
    sender: str | None
    body: str
    created_at: datetime
    read: bool


# ---- PTM --------------------------------------------------------------------------------------

class PtmIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    date: Day
    start_time: time
    end_time: time
    slot_minutes: int = Field(10, ge=5, le=60)
    section_ids: list[uuid.UUID] = Field(min_length=1, max_length=200)
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None

    @model_validator(mode="after")
    def _times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time: The meeting must end after it starts")
        return self


class PtmOut(BaseModel):
    id: uuid.UUID
    title: str
    date: Day
    start_time: str
    end_time: str
    slot_minutes: int
    sections_label: str
    location: str | None
    notes: str | None
    booked: int
    slots: int
    past: bool


class SlotOut(BaseModel):
    time: str
    free: bool
    mine: bool = False


class ChildSlots(BaseModel):
    student_id: uuid.UUID
    student_name: str
    teacher_id: uuid.UUID | None
    teacher_name: str | None
    booking: str | None  # the booked time, HH:MM
    slots: list[SlotOut]


class BookIn(BaseModel):
    student_id: uuid.UUID
    slot: Annotated[str, StringConstraints(pattern=r"^\d{2}:\d{2}$")]
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class ScheduleRow(BaseModel):
    time: str
    student_id: uuid.UUID | None
    student_name: str | None
    parent: str | None
    phone: str | None
    note: str | None


# ---- surveys ----------------------------------------------------------------------------------

class SurveyQuestion(BaseModel):
    id: Annotated[str, StringConstraints(min_length=1, max_length=20)]
    kind: Literal["choice", "multi", "rating", "text"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    options: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]] = Field(default_factory=list, max_length=12)
    required: bool = True

    @model_validator(mode="after")
    def _opts(self):
        if self.kind in ("choice", "multi") and len(self.options) < 2:
            raise ValueError("options: Give at least two options")
        return self


class SurveyIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    audience: Literal["everyone", "families", "staff", "sections"]
    section_ids: list[uuid.UUID] = Field(default_factory=list)
    questions: list[SurveyQuestion] = Field(min_length=1, max_length=30)
    anonymous: bool = False
    closes_at: datetime | None = None

    @model_validator(mode="after")
    def _shape(self):
        if self.audience == "sections" and not self.section_ids:
            raise ValueError("section_ids: Choose at least one class")
        ids = [q.id for q in self.questions]
        if len(set(ids)) != len(ids):
            raise ValueError("questions: Each question needs its own id")
        return self


class SurveyOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    audience: str
    audience_label: str
    section_ids: list[uuid.UUID]
    questions: list[dict]
    anonymous: bool
    closes_at: datetime | None
    published: bool
    open: bool
    responses: int = 0
    answered: bool = False
    can_edit: bool = False


class SurveyAnswer(BaseModel):
    answers: dict[str, str | int | list[str]]


class QuestionSummary(BaseModel):
    id: str
    kind: str
    text: str
    answers: int
    counts: dict[str, int] = {}  # option -> votes (choice, multi, rating)
    average: float | None = None  # rating
    texts: list[dict] = []  # [{text, by}] for text answers


class SurveyResults(BaseModel):
    survey: SurveyOut
    responses: int
    audience_size: int
    questions: list[QuestionSummary]
