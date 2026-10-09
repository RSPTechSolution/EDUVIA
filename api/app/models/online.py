"""Online tests (question bank, tests, attempts), co-scholastic grades, and live classes."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Question(Base, TenantMixin, TimestampMixin):
    """A question in the bank. `options` is [{id, text}]; `answer` holds the correct option ids, or accepted short answers."""
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # single | multiple | true_false | short
    text: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSONB, default=list)
    answer: Mapped[list] = mapped_column(JSONB, default=list)
    marks: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=1)
    explanation: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(100))
    difficulty: Mapped[str] = mapped_column(String(10), default="medium")  # easy | medium | hard
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class OnlineTest(Base, TenantMixin, TimestampMixin):
    __tablename__ = "online_tests"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    instructions: Mapped[str | None] = mapped_column(Text)
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"))
    section_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    question_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)  # in order
    opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    shuffle: Mapped[bool] = mapped_column(Boolean, default=True)
    show_results: Mapped[str] = mapped_column(String(20), default="after_close")  # after_submit | after_close | never
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class TestAttempt(Base, TenantMixin):
    """One student's attempt. `answers` maps question id -> option ids or text; `marks` question id -> marks given."""
    __tablename__ = "test_attempts"
    __table_args__ = (UniqueConstraint("test_id", "student_id", name="uq_attempt"),)
    __test__ = False  # not a pytest class

    id: Mapped[uuid.UUID] = uuid_pk()
    test_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_tests.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    order: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)  # the order this student saw
    answers: Mapped[dict] = mapped_column(JSONB, default=dict)
    marks: Mapped[dict] = mapped_column(JSONB, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    needs_marking: Mapped[bool] = mapped_column(Boolean, default=False)


class CoScholasticArea(Base, TenantMixin, TimestampMixin):
    """A graded area outside academics, e.g. Work education, Art, Health and PE, Discipline."""
    __tablename__ = "co_scholastic_areas"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class CoScholasticGrade(Base, TenantMixin):
    __tablename__ = "co_scholastic_grades"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", "area_id", name="uq_co_grade"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    exam_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    area_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("co_scholastic_areas.id", ondelete="CASCADE"))
    grade: Mapped[str] = mapped_column(String(2))  # A | B | C


class LiveClass(Base, TenantMixin, TimestampMixin):
    """An online lesson with a meeting link (Google Meet, Zoom, or a generated Jitsi room)."""
    __tablename__ = "live_classes"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    section_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=40)
    meeting_url: Mapped[str] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
