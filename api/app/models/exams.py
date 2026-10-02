import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base

class Question(Base):
    __tablename__ = "questions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    type: Mapped[str] = mapped_column(String(20))  # mcq|true_false|short|long|fill|match|audio|video|equation
    difficulty: Mapped[str] = mapped_column(String(10), default="medium")
    topic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content: Mapped[dict] = mapped_column(JSONB)  # question body + options + correct answers
    marks: Mapped[int] = mapped_column(default=1)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

class OnlineExam(Base):
    __tablename__ = "online_exams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    title: Mapped[str] = mapped_column(String(200))
    mode: Mapped[str] = mapped_column(String(20))  # exam|quiz|practice
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    question_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)))
    duration_minutes: Mapped[int] = mapped_column()
    shuffle_questions: Mapped[bool] = mapped_column(default=False)
    shuffle_options: Mapped[bool] = mapped_column(default=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    online_exam_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_exams.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    autosave_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {question_id: answer}
    score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    __table_args__ = (UniqueConstraint("online_exam_id", "student_id"),)
