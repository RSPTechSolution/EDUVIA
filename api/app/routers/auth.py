from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core import ratelimit
from app.core.config import settings
from app.core.deps import DB, Auth, client_ip
from app.core.errors import TooManyRequests
from app.core.security import create_download_token
from app.schemas.auth import (
    ChangePasswordRequest, LoginRequest, LoginResponse, MeOut, PasswordResetConfirm,
    PasswordResetRequest, RefreshRequest, TokenPair,
)
from app.schemas.common import ApiResponse, Message, ok
from app.services import auth_service

router = APIRouter()


@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(body: LoginRequest, request: Request, db: DB):
    ip = client_ip(request)
    key = f"rl:login:{ip}:{body.email.lower()}"
    if not await ratelimit.hit(key, settings.LOGIN_RATE_LIMIT, settings.LOGIN_RATE_WINDOW_SECONDS):
        raise TooManyRequests("Too many login attempts. Try again in 15 minutes.", code="RATE_LIMITED")
    result = await auth_service.login(db, body.email, body.password, body.school_slug,
                                      ip=ip, user_agent=request.headers.get("user-agent"))
    await ratelimit.reset(key)
    return ok(result)


@router.post("/refresh", response_model=ApiResponse[TokenPair])
async def refresh(body: RefreshRequest, request: Request, db: DB):
    return ok(await auth_service.refresh(db, body.refresh_token, ip=client_ip(request)))


@router.post("/logout", response_model=ApiResponse[Message])
async def logout(current: Auth, db: DB):
    await auth_service.revoke_session(db, current.session_id)
    return ok(Message(message="Logged out"))


@router.get("/me", response_model=ApiResponse[MeOut])
async def me(current: Auth, db: DB):
    return ok(await auth_service.build_me(db, current.user))


@router.post("/change-password", response_model=ApiResponse[Message])
async def change_password(body: ChangePasswordRequest, current: Auth, db: DB):
    await auth_service.change_password(db, current.user, current.session_id, body.current_password, body.new_password)
    return ok(Message(message="Password changed"))


@router.post("/password-reset/request", response_model=ApiResponse[Message])
async def password_reset_request(body: PasswordResetRequest, request: Request, db: DB):
    key = f"rl:reset:{client_ip(request)}"
    if not await ratelimit.hit(key, 5, 3600):
        raise TooManyRequests("Too many reset requests. Try again later.", code="RATE_LIMITED")
    await auth_service.request_password_reset(db, body.email, body.school_slug)
    # Same response whether or not the account exists.
    return ok(Message(message="If that account exists, a reset link has been sent."))


@router.post("/password-reset/confirm", response_model=ApiResponse[Message])
async def password_reset_confirm(body: PasswordResetConfirm, db: DB):
    await auth_service.confirm_password_reset(db, body.token, body.new_password)
    return ok(Message(message="Password updated. Please sign in."))


class DownloadLinkIn(BaseModel):
    path: str = Field(min_length=8, max_length=300, pattern=r"^/api/v1/[A-Za-z0-9/_\-.]+$")


@router.post("/download-link", response_model=ApiResponse[dict])
async def download_link(body: DownloadLinkIn, current: Auth):
    """A 10-minute link that opens one GET path (a PDF or file) without signing in again, for phones."""
    token = create_download_token(user_id=current.id, session_id=current.session_id, path=body.path)
    return ok({"url": f"{settings.API_PUBLIC_URL.rstrip('/')}{body.path}?dl={token}", "expires_in": 600})
