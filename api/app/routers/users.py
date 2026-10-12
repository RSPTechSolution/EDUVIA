import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import DB, CurrentUser, require_permission
from app.core.permissions import has_permission
from app.schemas.common import ApiResponse, Message, PageParams, ok
from app.schemas.user import AdminSetPassword, AuditLogOut, UserCreate, UserDetail, UserOut, UserUpdate
from app.services import user_service

router = APIRouter()


@router.get("", response_model=ApiResponse[list[UserOut]])
async def list_users(db: DB, page: PageParams = Depends(),
                     search: str | None = Query(None, max_length=100),
                     role: str | None = Query(None, max_length=50),
                     is_active: bool | None = None,
                     current: CurrentUser = require_permission("users.view")):
    rows, meta = await user_service.list_users(db, current.require_school(), page,
                                               search=search, role=role, is_active=is_active)
    return ok([UserOut.model_validate(u) for u in rows], meta)


@router.post("", response_model=ApiResponse[UserOut], status_code=201)
async def create_user(body: UserCreate, db: DB, current: CurrentUser = require_permission("users.manage")):
    return ok(UserOut.model_validate(await user_service.create_user(db, current.require_school(), body, actor_id=current.id)))


@router.get("/audit-log", response_model=ApiResponse[list[AuditLogOut]])
async def audit_log(db: DB, page: PageParams = Depends(), action: str | None = Query(None, max_length=100),
                    current: CurrentUser = require_permission("audit.view")):
    rows, meta = await user_service.list_audit(db, current.require_school(), page, action=action)
    return ok([AuditLogOut.model_validate(r) for r in rows], meta)


@router.get("/me/overview", response_model=ApiResponse[UserDetail])
async def my_overview(db: DB, current: CurrentUser = require_permission("school.view")):
    """Your own profile: your account and everything connected to you (classes, children, books, leave and pay...)."""
    return ok(await user_service.user_detail(db, current.require_school(), current.id, with_activity=True, with_hr=True))


@router.get("/{user_id}", response_model=ApiResponse[UserDetail])
async def get_user(user_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("users.view")):
    return ok(await user_service.user_detail(db, current.require_school(), user_id,
                                             with_activity=has_permission(current.role, "audit.view"),
                                             with_hr=has_permission(current.role, "hr.view")))


@router.patch("/{user_id}", response_model=ApiResponse[UserOut])
async def update_user(user_id: uuid.UUID, body: UserUpdate, db: DB,
                      current: CurrentUser = require_permission("users.manage")):
    user = await user_service.update_user(db, current.require_school(), user_id, body, actor_id=current.id)
    return ok(UserOut.model_validate(user))


@router.delete("/{user_id}", response_model=ApiResponse[Message])
async def delete_user(user_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("users.manage")):
    await user_service.delete_user(db, current.require_school(), user_id, actor_id=current.id)
    return ok(Message(message="User deleted"))


@router.post("/{user_id}/set-password", response_model=ApiResponse[Message])
async def set_password(user_id: uuid.UUID, body: AdminSetPassword, db: DB,
                       current: CurrentUser = require_permission("users.manage")):
    await user_service.admin_set_password(db, current.require_school(), user_id, body.password, actor_id=current.id)
    return ok(Message(message="Password set. The user must change it at next sign-in."))
