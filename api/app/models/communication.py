"""Notices (announcements) and homework."""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class Notice(Base, TenantMixin, TimestampMixin):
    """An announcement. `audience` picks who sees it; for "sections" the section ids say which classes."""
    __tablename__ = "notices"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(20))  # everyone | staff | families | sections
    section_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # normal | important | urgent
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class NoticeRead(Base, TenantMixin):
    __tablename__ = "notice_reads"
    __table_args__ = (UniqueConstraint("notice_id", "user_id", name="uq_notice_read"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    notice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("notices.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Homework(Base, TenantMixin, TimestampMixin):
    __tablename__ = "homework"

    id: Mapped[uuid.UUID] = uuid_pk()
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(200))
    details: Mapped[str | None] = mapped_column(Text)
    assigned_on: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class HomeworkStatus(Base, TenantMixin):
    """A student's progress on one piece of homework. No row means not done yet."""
    __tablename__ = "homework_status"
    __table_args__ = (UniqueConstraint("homework_id", "student_id", name="uq_homework_student"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    homework_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("homework.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20))  # done (by family) | checked | incomplete (by teacher)
    note: Mapped[str | None] = mapped_column(String(300))  # from the student or parent
    remark: Mapped[str | None] = mapped_column(String(300))  # from the teacher
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
