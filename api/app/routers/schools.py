import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import DB, CurrentUser, require_permission, require_super_admin
from app.schemas.common import ApiResponse, PageParams, ok
from app.schemas.school import (
    ModuleOut, ModuleToggle, SchoolAdminUpdate, SchoolCreate, SchoolOut, SchoolUpdate,
)
from app.services import school_service

router = APIRouter()


# ---- current school (school users) -------------------------------------------------

@router.get("/current", response_model=ApiResponse[SchoolOut])
async def current_school(db: DB, current: CurrentUser = require_permission("school.view")):
    return ok(SchoolOut.model_validate(await school_service.get_school(db, current.require_school())))


@router.patch("/current", response_model=ApiResponse[SchoolOut])
async def update_current_school(body: SchoolUpdate, db: DB, current: CurrentUser = require_permission("school.manage")):
    school = await school_service.get_school(db, current.require_school())
    return ok(SchoolOut.model_validate(await school_service.update_school(db, school, body, actor_id=current.id)))


@router.get("/current/modules", response_model=ApiResponse[list[ModuleOut]])
async def current_modules(db: DB, current: CurrentUser = require_permission("school.view")):
    return ok(await school_service.list_modules(db, current.require_school()))


@router.put("/current/modules/{module}", response_model=ApiResponse[ModuleOut])
async def toggle_module(module: str, body: ModuleToggle, db: DB,
                        current: CurrentUser = require_permission("modules.manage")):
    return ok(await school_service.set_module(db, current.require_school(), module, body.is_enabled, actor_id=current.id))


# ---- platform (super admin) ---------------------------------------------------------

@router.get("", response_model=ApiResponse[list[SchoolOut]])
async def list_schools(db: DB, page: PageParams = Depends(), search: str | None = Query(None, max_length=100),
                       is_active: bool | None = None, _: CurrentUser = require_super_admin()):
    rows, meta = await school_service.list_schools(db, page, search, is_active)
    return ok([SchoolOut.model_validate(s) for s in rows], meta)


@router.post("", response_model=ApiResponse[SchoolOut], status_code=201)
async def create_school(body: SchoolCreate, db: DB, current: CurrentUser = require_super_admin()):
    return ok(SchoolOut.model_validate(await school_service.create_school(db, body, actor_id=current.id)))


@router.get("/{school_id}", response_model=ApiResponse[SchoolOut])
async def get_school(school_id: uuid.UUID, db: DB, _: CurrentUser = require_super_admin()):
    return ok(SchoolOut.model_validate(await school_service.get_school(db, school_id)))


@router.patch("/{school_id}", response_model=ApiResponse[SchoolOut])
async def admin_update_school(school_id: uuid.UUID, body: SchoolAdminUpdate, db: DB,
                              current: CurrentUser = require_super_admin()):
    school_service.ensure_valid_plan(body.plan)
    school = await school_service.get_school(db, school_id)
    return ok(SchoolOut.model_validate(await school_service.update_school(db, school, body, actor_id=current.id)))


@router.get("/{school_id}/modules", response_model=ApiResponse[list[ModuleOut]])
async def school_modules(school_id: uuid.UUID, db: DB, _: CurrentUser = require_super_admin()):
    await school_service.get_school(db, school_id)
    return ok(await school_service.list_modules(db, school_id))


@router.put("/{school_id}/modules/{module}", response_model=ApiResponse[ModuleOut])
async def admin_toggle_module(school_id: uuid.UUID, module: str, body: ModuleToggle, db: DB,
                              current: CurrentUser = require_super_admin()):
    await school_service.get_school(db, school_id)
    return ok(await school_service.set_module(db, school_id, module, body.is_enabled, actor_id=current.id))
