"""Written exams: the date sheet, marks and report-card remarks."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Exam(Base, TenantMixin, TimestampMixin):
    """An exam season, e.g. "Half-Yearly 2026-27". Results are hidden from families until published."""
    __tablename__ = "exams"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_exam_name"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(20), default="term")  # unit_test | term | final
    academic_year: Mapped[str] = mapped_column(String(10))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExamPaper(Base, TenantMixin):
    """One subject's paper for one class: a row of the date sheet."""
    __tablename__ = "exam_papers"
    __table_args__ = (UniqueConstraint("exam_id", "class_id", "subject_id", name="uq_exam_paper"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    exam_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"))
    exam_date: Mapped[date | None] = mapped_column(Date)
    max_marks: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    pass_marks: Mapped[Decimal] = mapped_column(Numeric(6, 2))


class ExamMark(Base, TenantMixin):
    __tablename__ = "exam_marks"
    __table_args__ = (UniqueConstraint("paper_id", "student_id", name="uq_exam_mark"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exam_papers.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    marks: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))  # null when absent
    absent: Mapped[bool] = mapped_column(Boolean, default=False)
    entered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ExamRemark(Base, TenantMixin):
    """The class teacher's comment on a student's report card."""
    __tablename__ = "exam_remarks"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_remark"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    exam_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"))
    remark: Mapped[str] = mapped_column(Text)
