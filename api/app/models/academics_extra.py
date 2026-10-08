"""Academics extras: syllabus and lesson plans, certificates, admission enquiries, substitutions."""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class SyllabusTopic(Base, TenantMixin, TimestampMixin):
    """One chapter or topic of a subject's syllabus for a class."""
    __tablename__ = "syllabus_topics"

    id: Mapped[uuid.UUID] = uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    unit: Mapped[str | None] = mapped_column(String(100))  # e.g. "Unit 2: Algebra"
    title: Mapped[str] = mapped_column(String(200))
    planned_month: Mapped[str | None] = mapped_column(String(7))  # YYYY-MM
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class TopicProgress(Base, TenantMixin):
    """A topic finished in one section."""
    __tablename__ = "topic_progress"
    __table_args__ = (UniqueConstraint("topic_id", "section_id", name="uq_topic_section"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("syllabus_topics.id", ondelete="CASCADE"), index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    completed_on: Mapped[date] = mapped_column(Date)
    completed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class LessonPlan(Base, TenantMixin, TimestampMixin):
    """What a teacher plans to teach a section on a day."""
    __tablename__ = "lesson_plans"

    id: Mapped[uuid.UUID] = uuid_pk()
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"))
    topic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("syllabus_topics.id", ondelete="SET NULL"))
    date: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str] = mapped_column(String(200))
    objectives: Mapped[str | None] = mapped_column(Text)
    activities: Mapped[str | None] = mapped_column(Text)
    resources: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="planned")  # planned | taught
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)


class Certificate(Base, TenantMixin, TimestampMixin):
    """An issued certificate: transfer (TC), bonafide, character. `details` holds the kind's fields."""
    __tablename__ = "certificates"
    __table_args__ = (UniqueConstraint("school_id", "serial_no", name="uq_certificate_serial"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # transfer | bonafide | character
    serial_no: Mapped[str] = mapped_column(String(30))
    issued_on: Mapped[date] = mapped_column(Date)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    issued_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Enquiry(Base, TenantMixin, TimestampMixin):
    """An admission enquiry, from the office or the public website."""
    __tablename__ = "enquiries"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_name: Mapped[str] = mapped_column(String(200))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))
    class_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"))
    parent_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(200))
    previous_school: Mapped[str | None] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20), default="walk_in")  # walk_in | phone | website | referral | other
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)  # new | contacted | visit | applied | admitted | lost
    follow_up_on: Mapped[date | None] = mapped_column(Date, index=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    notes: Mapped[list] = mapped_column(JSONB, default=list)  # [{at, by, text}]
    student_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"))


class Substitution(Base, TenantMixin, TimestampMixin):
    """Someone covering one timetable period on one date for an absent teacher."""
    __tablename__ = "substitutions"
    __table_args__ = (UniqueConstraint("entry_id", "date", name="uq_substitution_entry_date"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    date: Mapped[date] = mapped_column(Date, index=True)
    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("timetable_entries.id", ondelete="CASCADE"))
    absent_teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    substitute_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    note: Mapped[str | None] = mapped_column(String(200))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
