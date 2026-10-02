import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Conflict, NotFound
from app.core.permissions import Role
from app.core.security import hash_password
from app.models import AuditLog, User
from app.schemas.common import PageMeta, PageParams
from app.schemas.user import UserCreate, UserUpdate
from app.services import audit_service
from app.services.auth_service import revoke_user_sessions


async def list_users(db: AsyncSession, school_id: uuid.UUID, page: PageParams, *,
                     search: str | None = None, role: str | None = None,
                     is_active: bool | None = None) -> tuple[list[User], PageMeta]:
    stmt = select(User).where(User.school_id == school_id, User.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(or_(func.lower(User.full_name).like(like), User.email.like(like), User.phone.like(like)))
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(User.full_name).offset(page.offset).limit(page.page_size))
    return list(rows.all()), PageMeta(total=total or 0, page=page.page, page_size=page.page_size)


async def get_user(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> User:
    user = await db.scalar(select(User).where(User.id == user_id, User.school_id == school_id, User.deleted_at.is_(None)))
    if not user:
        raise NotFound("User not found")
    return user


async def _email_taken(db: AsyncSession, school_id: uuid.UUID, email: str) -> bool:
    return bool(await db.scalar(select(User.id).where(
        User.school_id == school_id, User.email == email, User.deleted_at.is_(None))))


async def create_user(db: AsyncSession, school_id: uuid.UUID, data: UserCreate, *, actor_id: uuid.UUID) -> User:
    email = data.email.lower()
    if await _email_taken(db, school_id, email):
        raise Conflict("A user with this email already exists", code="EMAIL_TAKEN")
    user = User(school_id=school_id, email=email, full_name=data.full_name, phone=data.phone,
                role=data.role, password_hash=hash_password(data.password), must_change_password=True)
    db.add(user)
    await db.flush()
    await audit_service.record(db, "user.create", school_id=school_id, user_id=actor_id,
                               entity_type="user", entity_id=user.id, meta={"role": data.role})
    return user


async def _active_admin_count(db: AsyncSession, school_id: uuid.UUID) -> int:
    return await db.scalar(select(func.count()).where(
        User.school_id == school_id, User.role == Role.SCHOOL_ADMIN,
        User.is_active.is_(True), User.deleted_at.is_(None))) or 0


async def update_user(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID, data: UserUpdate,
                      *, actor_id: uuid.UUID) -> User:
    user = await get_user(db, school_id, user_id)
    changes = data.model_dump(exclude_unset=True)
    if user.id == actor_id and ("role" in changes or changes.get("is_active") is False):
        raise BadRequest("You cannot change your own role or deactivate yourself", code="SELF_MODIFICATION")
    losing_admin = user.role == Role.SCHOOL_ADMIN and (
        changes.get("role", Role.SCHOOL_ADMIN) != Role.SCHOOL_ADMIN or changes.get("is_active") is False)
    if losing_admin and await _active_admin_count(db, school_id) <= 1:
        raise BadRequest("A school must keep at least one active admin", code="LAST_ADMIN")
    for field, value in changes.items():
        setattr(user, field, value)
    if changes.get("is_active") is False or "role" in changes:
        await revoke_user_sessions(db, user.id)  # new role/permissions take effect on next login
    await audit_service.record(db, "user.update", school_id=school_id, user_id=actor_id,
                               entity_type="user", entity_id=user.id, meta={"fields": sorted(changes)})
    await db.flush()
    return user


async def delete_user(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID, *, actor_id: uuid.UUID) -> None:
    user = await get_user(db, school_id, user_id)
    if user.id == actor_id:
        raise BadRequest("You cannot delete your own account", code="SELF_MODIFICATION")
    if user.role == Role.SCHOOL_ADMIN and user.is_active and await _active_admin_count(db, school_id) <= 1:
        raise BadRequest("A school must keep at least one active admin", code="LAST_ADMIN")
    user.deleted_at = datetime.now(UTC)
    user.is_active = False
    await revoke_user_sessions(db, user.id)
    await audit_service.record(db, "user.delete", school_id=school_id, user_id=actor_id,
                               entity_type="user", entity_id=user.id)


async def admin_set_password(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID, password: str,
                             *, actor_id: uuid.UUID) -> None:
    user = await get_user(db, school_id, user_id)
    user.password_hash = hash_password(password)
    user.must_change_password = True
    await revoke_user_sessions(db, user.id)
    await audit_service.record(db, "user.password_set", school_id=school_id, user_id=actor_id,
                               entity_type="user", entity_id=user.id)


async def list_audit(db: AsyncSession, school_id: uuid.UUID, page: PageParams, *,
                     action: str | None = None) -> tuple[list[dict], PageMeta]:
    base = select(AuditLog).where(AuditLog.school_id == school_id)
    if action:
        base = base.where(AuditLog.action.like(f"{action}%"))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    stmt = (base.add_columns(User.full_name).outerjoin(User, User.id == AuditLog.user_id)
            .order_by(AuditLog.created_at.desc()).offset(page.offset).limit(page.page_size))
    rows = (await db.execute(stmt)).all()
    items = [{**{c.key: getattr(log, c.key) for c in AuditLog.__table__.columns}, "user_name": name} for log, name in rows]
    return items, PageMeta(total=total or 0, page=page.page, page_size=page.page_size)
