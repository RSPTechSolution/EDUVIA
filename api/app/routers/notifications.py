"""The signed-in user's notification centre, and the phones that receive their pushes."""
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import DB, Auth
from app.schemas.common import ApiResponse, Message, PageParams, ok
from app.services import notification_service

router = APIRouter()


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    body: str | None
    link: str | None
    data: dict
    read: bool
    created_at: datetime


class DeviceIn(BaseModel):
    token: str = Field(min_length=10, max_length=400)
    platform: Literal["android", "ios", "web"]
    app: Literal["parent", "staff", "driver"] = "parent"


class DeviceOut(BaseModel):
    token: str = Field(min_length=10, max_length=400)


@router.get("", response_model=ApiResponse[list[NotificationOut]])
async def list_mine(current: Auth, db: DB, page: PageParams = Depends(), unread: bool = False):
    rows, meta = await notification_service.list_for(db, current.user, page, unread_only=unread)
    return ok([NotificationOut(id=n.id, kind=n.kind, title=n.title, body=n.body, link=n.link, data=n.data or {},
                               read=n.read_at is not None, created_at=n.created_at) for n in rows], meta)


@router.get("/unread-count", response_model=ApiResponse[dict])
async def unread(current: Auth, db: DB):
    return ok({"count": await notification_service.unread_count(db, current.user)})


@router.post("/read-all", response_model=ApiResponse[dict])
async def read_all(current: Auth, db: DB):
    return ok({"marked": await notification_service.mark_all_read(db, current.user)})


@router.post("/devices", response_model=ApiResponse[Message])
async def register_device(body: DeviceIn, current: Auth, db: DB):
    await notification_service.register_device(db, current.user, body.token, body.platform, body.app)
    return ok(Message(message="This device will get notifications"))


@router.post("/devices/remove", response_model=ApiResponse[Message])
async def remove_device(body: DeviceOut, current: Auth, db: DB):
    await notification_service.unregister_device(db, current.user, body.token)
    return ok(Message(message="This device won't get notifications"))


@router.post("/{notification_id}/read", response_model=ApiResponse[Message])
async def read_one(notification_id: uuid.UUID, current: Auth, db: DB):
    await notification_service.mark_read(db, current.user, notification_id)
    return ok(Message(message="Marked as read"))
