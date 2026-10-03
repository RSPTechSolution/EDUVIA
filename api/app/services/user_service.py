import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, BadRequest, Conflict, NotFound
from app.core.permissions import Role
from app.core.security import hash_password
from app.core import roles
from app.models import AuditLog, School, SchoolClass, Section, Student, StudentGuardian, User
from app.schemas.common import PageMeta, PageParams
from app.schemas.user import LinkedChild, UserCreate, UserDetail, UserUpdate
from app.services.academics_service import field_error
from app.services import audit_service, billing_service
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


async def user_detail(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> UserDetail:
    user = await get_user(db, school_id, user_id)
    out = UserDetail.model_validate(user)
    if user.role == Role.PARENT:
        rows = (await db.execute(
            select(Student, StudentGuardian.relationship, SchoolClass.name, Section.name)
            .join(StudentGuardian, StudentGuardian.student_id == Student.id)
            .join(SchoolClass, SchoolClass.id == Student.class_id).join(Section, Section.id == Student.section_id)
            .where(StudentGuardian.user_id == user.id).order_by(Student.first_name)
        )).all()
        out.children = [LinkedChild(student_id=s.id, name=f"{s.first_name} {s.last_name}", class_section=f"{c} – {sec}",
                                    relationship=rel) for s, rel, c, sec in rows]
    if user.role == Role.STUDENT:
        st = await db.scalar(select(Student).where(Student.user_id == user.id))
        if st:
            out.student_id, out.student_name = st.id, f"{st.first_name} {st.last_name}"
    return out


async def _email_taken(db: AsyncSession, school_id: uuid.UUID, email: str) -> bool:
    return bool(await db.scalar(select(User.id).where(
        User.school_id == school_id, User.email == email, User.deleted_at.is_(None))))


async def create_user(db: AsyncSession, school_id: uuid.UUID, data: UserCreate, *, actor_id: uuid.UUID) -> User:
    email = data.email.lower()
    if await _email_taken(db, school_id, email):
        raise Conflict("A user with this email already exists", code="EMAIL_TAKEN")
    await billing_service.check_capacity(db, await db.get(School, school_id), data.role)

    # Role-specific requirements (e.g. parents need a child, drivers a licence).
    values = data.model_dump()
    missing = roles.missing_fields(data.role, values)
    if missing:
        raise AppError("Some required details are missing", code="VALIDATION_ERROR", status_code=422, details=[
            {"field": f, "message": f"{roles.FIELD_LABELS[f]} is required for this role"} for f in missing])
    allowed = set(roles.ROLE_RULES[data.role]["required"]) | set(roles.ROLE_RULES[data.role]["optional"])
    extra = {f: values[f] for f in ("phone", "employee_id", "designation", "license_no") if f in allowed}

    student = None
    if data.role == Role.STUDENT:
        student = await db.scalar(select(Student).where(Student.id == data.student_id, Student.school_id == school_id))
        if not student or student.status != "active":
            raise field_error("student_id", "Choose an active student record")
        if student.user_id:
            raise field_error("student_id", "This student already has a login")
    children = []
    if data.role == Role.PARENT:
        seen = set()
        for i, c in enumerate(data.children or []):
            if c.student_id in seen:
                raise field_error(f"children.{i}", "This child is listed twice")
            seen.add(c.student_id)
            st = await db.scalar(select(Student).where(Student.id == c.student_id, Student.school_id == school_id))
            if not st:
                raise field_error(f"children.{i}", "Choose a student from your school")
            children.append((st, c.relationship))

    user = User(school_id=school_id, email=email, full_name=data.full_name, role=data.role,
                password_hash=hash_password(data.password), must_change_password=True, **extra)
    db.add(user)
    await db.flush()
    if student:
        student.user_id = user.id
    for st, relationship in children:
        has_primary = await db.scalar(select(StudentGuardian.id).where(
            StudentGuardian.student_id == st.id, StudentGuardian.is_primary.is_(True)))
        db.add(StudentGuardian(school_id=school_id, student_id=st.id, user_id=user.id,
                               relationship=relationship, is_primary=not has_primary))
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
    if "role" in changes and changes["role"] != user.role and (
            changes["role"] in roles.LINKED_ROLES or user.role in roles.LINKED_ROLES):
        raise BadRequest("Parent and student accounts are linked to student records, so their role can't be changed. "
                         "Create a new account instead.", code="ROLE_CHANGE_NOT_ALLOWED")
    new_role = changes.get("role", user.role)
    after = {f: changes.get(f, getattr(user, f)) for f in ("phone", "employee_id", "designation", "license_no")}
    # Links (children/student) already exist for these accounts; only check the plain fields.
    missing = [f for f in roles.missing_fields(new_role, {**after, "children": True, "student_id": True})]
    if missing:
        raise AppError("Some required details are missing", code="VALIDATION_ERROR", status_code=422, details=[
            {"field": f, "message": f"{roles.FIELD_LABELS[f]} is required for this role"} for f in missing])
    if user.id == actor_id and ("role" in changes or changes.get("is_active") is False):
        raise BadRequest("You cannot change your own role or deactivate yourself", code="SELF_MODIFICATION")
    losing_admin = user.role == Role.SCHOOL_ADMIN and (
        changes.get("role", Role.SCHOOL_ADMIN) != Role.SCHOOL_ADMIN or changes.get("is_active") is False)
    if losing_admin and await _active_admin_count(db, school_id) <= 1:
        raise BadRequest("A school must keep at least one active admin", code="LAST_ADMIN")
    # Taking up a new seat (reactivation or moving into a limited role) must fit the plan.
    new_role = changes.get("role", user.role)
    reactivating = changes.get("is_active") is True and not user.is_active
    if reactivating or (user.is_active and new_role != user.role):
        await billing_service.check_capacity(db, await db.get(School, school_id), new_role)
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
