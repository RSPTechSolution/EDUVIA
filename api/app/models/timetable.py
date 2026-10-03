"""Subjects, the bell schedule and the weekly timetable."""
import uuid
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Index, Integer, SmallInteger, String, Time, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Subject(Base, TenantMixin, TimestampMixin):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_subject_name"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str | None] = mapped_column(String(20))
    color: Mapped[str] = mapped_column(String(20), default="blue")


class Period(Base, TenantMixin, TimestampMixin):
    """One slot in the school day, the same for every working day. Breaks can't be timetabled."""
    __tablename__ = "periods"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(50))
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_break: Mapped[bool] = mapped_column(Boolean, default=False)


class TeacherSubject(Base, TenantMixin):
    """Subjects a teacher is qualified to teach."""
    __tablename__ = "teacher_subjects"
    __table_args__ = (UniqueConstraint("teacher_id", "subject_id", name="uq_teacher_subject"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), index=True)


class TeacherUnavailability(Base, TenantMixin):
    """A weekly slot a teacher can't be scheduled in (part-time, admin duty, ...)."""
    __tablename__ = "teacher_unavailability"
    __table_args__ = (UniqueConstraint("teacher_id", "day", "period_id", name="uq_teacher_unavailable"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[int] = mapped_column(SmallInteger)  # 1 = Monday .. 6 = Saturday
    period_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("periods.id", ondelete="CASCADE"))


class TimetableEntry(Base, TenantMixin, TimestampMixin):
    """What a section has in one period of one weekday. A teacher can only be in one place at a time."""
    __tablename__ = "timetable_entries"
    __table_args__ = (
        UniqueConstraint("section_id", "day", "period_id", name="uq_timetable_slot"),
        Index("uq_timetable_teacher_slot", "teacher_id", "day", "period_id", unique=True,
              postgresql_where=text("teacher_id IS NOT NULL")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    day: Mapped[int] = mapped_column(SmallInteger)
    period_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("periods.id", ondelete="CASCADE"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"))
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    room: Mapped[str | None] = mapped_column(String(30))
