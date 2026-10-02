import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequest, Conflict, NotFound
from app.core.permissions import MODULES, Role
from app.core.security import hash_password
from app.models import School, SchoolModule, User
from app.schemas.common import PageMeta, PageParams
from app.schemas.school import ModuleOut, SchoolCreate, SchoolUpdate
from app.services import audit_service


async def get_school(db: AsyncSession, school_id: uuid.UUID) -> School:
    school = await db.get(School, school_id)
    if not school:
        raise NotFound("School not found")
    return school


async def update_school(db: AsyncSession, school: School, data: SchoolUpdate, *, actor_id: uuid.UUID) -> School:
    changes = data.model_dump(exclude_unset=True)
    if "settings" in changes:
        changes["settings"] = {**(school.settings or {}), **(changes["settings"] or {})}
    for field, value in changes.items():
        setattr(school, field, value)
    await audit_service.record(db, "school.update", school_id=school.id, user_id=actor_id,
                               entity_type="school", entity_id=school.id, meta={"fields": sorted(changes)})
    await db.flush()
    return school


async def list_modules(db: AsyncSession, school_id: uuid.UUID) -> list[ModuleOut]:
    rows = await db.scalars(select(SchoolModule).where(SchoolModule.school_id == school_id))
    enabled = {m.module: m.is_enabled for m in rows.all()}
    return [ModuleOut(module=k, label=v["label"], is_enabled=enabled.get(k, False)) for k, v in MODULES.items()]


async def set_module(db: AsyncSession, school_id: uuid.UUID, module: str, enabled: bool, *, actor_id: uuid.UUID) -> ModuleOut:
    if module not in MODULES:
        raise NotFound(f"Unknown module: {module}")
    row = await db.scalar(select(SchoolModule).where(SchoolModule.school_id == school_id, SchoolModule.module == module))
    if row:
        row.is_enabled = enabled
    else:
        db.add(SchoolModule(school_id=school_id, module=module, is_enabled=enabled))
    await audit_service.record(db, "school.module_toggle", school_id=school_id, user_id=actor_id,
                               entity_type="module", entity_id=module, meta={"enabled": enabled})
    await db.flush()
    return ModuleOut(module=module, label=MODULES[module]["label"], is_enabled=enabled)


async def list_schools(db: AsyncSession, page: PageParams, search: str | None,
                       is_active: bool | None = None) -> tuple[list[School], PageMeta]:
    stmt = select(School)
    if is_active is not None:
        stmt = stmt.where(School.is_active.is_(is_active))
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(or_(func.lower(School.name).like(like), School.slug.like(like)))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(School.created_at.desc()).offset(page.offset).limit(page.page_size))
    return list(rows.all()), PageMeta(total=total or 0, page=page.page, page_size=page.page_size)


async def create_school(db: AsyncSession, data: SchoolCreate, *, actor_id: uuid.UUID) -> School:
    """School + its first admin + default modules, all in the caller's transaction."""
    if await db.scalar(select(School.id).where(School.slug == data.slug)):
        raise Conflict("That school ID is already taken", code="SLUG_TAKEN")
    school = School(name=data.name, slug=data.slug, timezone=data.timezone,
                    currency=data.currency.upper(), language=data.language)
    db.add(school)
    await db.flush()
    db.add(User(school_id=school.id, email=data.admin_email.lower(), full_name=data.admin_full_name,
                password_hash=hash_password(data.admin_password), role=Role.SCHOOL_ADMIN,
                must_change_password=True))
    for slug, meta in MODULES.items():
        if meta["default"]:
            db.add(SchoolModule(school_id=school.id, module=slug, is_enabled=True))
    await audit_service.record(db, "school.create", school_id=school.id, user_id=actor_id,
                               entity_type="school", entity_id=school.id)
    await db.flush()
    return school


def ensure_valid_plan(plan: str | None) -> None:
    if plan is not None and not plan.strip():
        raise BadRequest("Plan cannot be empty")
