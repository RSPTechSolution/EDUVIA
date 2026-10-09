"""SMS/WhatsApp log, parent-teacher chat, parent-teacher meeting slots, and surveys."""
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, uuid_pk


class MessageLog(Base):
    """Every SMS or WhatsApp message the school sent (or would have, in console mode)."""
    __tablename__ = "message_log"

    id: Mapped[uuid.UUID] = uuid_pk()
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(10))  # sms | whatsapp
    to: Mapped[str] = mapped_column(String(20))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30))  # absent | fee_reminder | test | ...
    status: Mapped[str] = mapped_column(String(10), default="queued")  # queued | sent | failed | logged
    error: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Conversation(Base, TenantMixin, TimestampMixin):
    """A private thread between one parent (or the student) and one member of staff, about one student."""
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("student_id", "family_id", "staff_id", name="uq_conversation"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class ChatMessage(Base, TenantMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = uuid_pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class PtmEvent(Base, TenantMixin, TimestampMixin):
    """A parent-teacher meeting day: families book a slot with their child's class teacher."""
    __tablename__ = "ptm_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    slot_minutes: Mapped[int] = mapped_column(Integer, default=10)
    section_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    location: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class PtmBooking(Base, TenantMixin):
    __tablename__ = "ptm_bookings"
    __table_args__ = (UniqueConstraint("event_id", "teacher_id", "slot", name="uq_ptm_slot"),
                      UniqueConstraint("event_id", "student_id", name="uq_ptm_student"))

    id: Mapped[uuid.UUID] = uuid_pk()
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ptm_events.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    slot: Mapped[time] = mapped_column(Time)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"))
    booked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Survey(Base, TenantMixin, TimestampMixin):
    """`questions` is [{id, kind: choice|multi|rating|text, text, options: [..], required}]."""
    __tablename__ = "surveys"

    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(20))  # everyone | families | staff | sections
    section_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    questions: Mapped[list] = mapped_column(JSONB, default=list)
    anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class SurveyResponse(Base, TenantMixin):
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("survey_id", "user_id", name="uq_survey_response"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    survey_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    answers: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
