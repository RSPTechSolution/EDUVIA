"""Email status, the sent-email log, and a test send for school admins."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import DB, CurrentUser, require_permission
from app.core.errors import AppError
from app.models import EmailLog, School
from app.schemas.common import ApiResponse, PageMeta, PageParams, ok
from app.services import email_service, email_templates

router = APIRouter()


class EmailStatus(BaseModel):
    provider: str  # console | brevo-api | brevo-smtp
    sending: bool  # false in console mode: emails are only logged
    sender: str
    sent_today: int
    daily_limit: int


class EmailLogOut(BaseModel):
    id: uuid.UUID
    to_email: str
    to_name: str | None
    subject: str
    kind: str
    status: str
    error: str | None
    created_at: datetime
    sent_at: datetime | None


class TestEmail(BaseModel):
    to: EmailStr


@router.get("/status", response_model=ApiResponse[EmailStatus])
async def status(db: DB, current: CurrentUser = require_permission("emails.view")):
    school_id = current.require_school()
    return ok(EmailStatus(provider=email_service.provider_name(), sending=email_service.provider_name() != "console",
                          sender=f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>",
                          sent_today=await email_service.sent_today(db, school_id), daily_limit=settings.EMAIL_DAILY_LIMIT))


@router.get("", response_model=ApiResponse[list[EmailLogOut]])
async def history(db: DB, page: PageParams = Depends(), kind: str | None = None, status: str | None = None,
                  current: CurrentUser = require_permission("emails.view")):
    stmt = select(EmailLog).where(EmailLog.school_id == current.require_school())
    if kind:
        stmt = stmt.where(EmailLog.kind == kind)
    if status:
        stmt = stmt.where(EmailLog.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await db.scalars(stmt.order_by(EmailLog.created_at.desc()).offset(page.offset).limit(page.page_size))).all()
    return ok([EmailLogOut.model_validate(r, from_attributes=True) for r in rows], PageMeta(total=total, page=page.page, page_size=page.page_size))


@router.post("/test", response_model=ApiResponse[EmailLogOut], status_code=201)
async def send_test(body: TestEmail, db: DB, current: CurrentUser = require_permission("emails.manage")):
    """Queue a test email. It goes out right after this request; refresh the log to see whether it was delivered."""
    school_id = current.require_school()
    if await email_service.sent_today(db, school_id) >= settings.EMAIL_DAILY_LIMIT:
        raise AppError("Today's email limit has been reached", code="EMAIL_LIMIT", status_code=429)
    school = await db.get(School, school_id)
    msg = email_templates.test_email(to=body.to, school_name=school.name, sender=current.user.full_name)
    await email_service.queue(db, msg, school_id=school_id)
    row = await db.get(EmailLog, msg.log_id)
    return ok(EmailLogOut.model_validate(row, from_attributes=True))
