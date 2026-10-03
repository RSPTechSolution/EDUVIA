"""Plans, limits, sign-up and enquiries.

Plan enforcement happens in three places:
- modules: a module only counts as enabled if the school's plan includes it
  (app.core.deps.enabled_modules) and admins can't switch on modules outside it;
- limits: creating/reactivating users is refused once the plan's student or
  staff limit is reached (check_capacity);
- plan changes: a school can't move to a plan its current usage doesn't fit.
"""
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import pricing
from app.core.database import elevated, set_tenant
from app.core.errors import BadRequest, Conflict, Forbidden, NotFound
from app.core.permissions import MODULES, STAFF_ROLES, Role
from app.core.security import hash_password
from app.models import Lead, Plan, School, SchoolModule, User
from app.services import audit_service

STAFF_ROLE_VALUES = {r.value for r in STAFF_ROLES}


def _now() -> datetime:
    return datetime.now(UTC)


# ---- plans --------------------------------------------------------------------------

async def public_plans(db: AsyncSession) -> list[Plan]:
    rows = await db.scalars(select(Plan).where(Plan.is_public.is_(True), Plan.is_active.is_(True)).order_by(Plan.sort_order))
    return list(rows.all())


async def plan_by_code(db: AsyncSession, code: str, *, public_only: bool = True) -> Plan:
    stmt = select(Plan).where(Plan.code == code, Plan.is_active.is_(True))
    if public_only:
        stmt = stmt.where(Plan.is_public.is_(True))
    plan = await db.scalar(stmt)
    if not plan:
        raise NotFound(f"Unknown plan: {code}", code="PLAN_NOT_FOUND")
    return plan


def cheapest_plan_with(plans: list[Plan], module: str) -> Plan | None:
    candidates = [p for p in plans if module in p.modules]
    return min(candidates, key=lambda p: p.price_monthly) if candidates else None


async def create_custom_plan(db: AsyncSession, q: pricing.Quote, label: str) -> Plan:
    plan = custom_plan_from_quote(q, label)
    async with elevated(db):  # plans are writable only with bypass
        db.add(plan)
        await db.flush()
    return plan


def custom_plan_from_quote(q: pricing.Quote, label: str) -> Plan:
    extras = [MODULES[m]["label"] for m in q.modules if m not in pricing.CORE_MODULES]
    return Plan(
        code=f"custom-{label[:40]}-{secrets.token_hex(3)}",
        name="Custom",
        tagline="Built for your school",
        price_monthly=q.monthly,
        price_yearly=q.yearly,
        max_students=q.students,
        max_staff=q.max_staff,
        storage_gb=q.storage_gb,
        modules=q.modules,
        features=["Core student, academic and attendance tools", *extras, "Parent, staff and driver apps", "Email support"],
        is_public=False,
        is_custom=True,
        sort_order=99,
    )


# ---- usage and limits -----------------------------------------------------------------

async def usage(db: AsyncSession, school_id: uuid.UUID) -> dict[str, int]:
    # Counted from user accounts for now; the students module (next phase) will count student records.
    rows = (await db.execute(
        select(User.role, func.count()).where(
            User.school_id == school_id, User.is_active.is_(True), User.deleted_at.is_(None)
        ).group_by(User.role)
    )).all()
    by_role = {r: n for r, n in rows}
    return {
        "students": by_role.get(Role.STUDENT, 0),
        "staff": sum(n for r, n in by_role.items() if r in STAFF_ROLE_VALUES),
    }


async def check_capacity(db: AsyncSession, school: School, role: str) -> None:
    """Refuse adding one more active user of `role` beyond the plan limit."""
    used = await usage(db, school.id)
    plan = school.plan
    if role == Role.STUDENT and plan.max_students is not None and used["students"] >= plan.max_students:
        raise Forbidden(
            f"Your {plan.name} plan allows {plan.max_students} students. Upgrade to add more.",
            code="PLAN_LIMIT_REACHED", details={"limit": "students", "max": plan.max_students},
        )
    if role in STAFF_ROLE_VALUES and plan.max_staff is not None and used["staff"] >= plan.max_staff:
        raise Forbidden(
            f"Your {plan.name} plan allows {plan.max_staff} staff accounts. Upgrade to add more.",
            code="PLAN_LIMIT_REACHED", details={"limit": "staff", "max": plan.max_staff},
        )


def _fits(used: dict[str, int], plan: Plan) -> str | None:
    if plan.max_students is not None and used["students"] > plan.max_students:
        return f"you have {used['students']} students and {plan.name} allows {plan.max_students}"
    if plan.max_staff is not None and used["staff"] > plan.max_staff:
        return f"you have {used['staff']} staff accounts and {plan.name} allows {plan.max_staff}"
    return None


async def _enable_plan_modules(db: AsyncSession, school_id: uuid.UUID, plan: Plan) -> None:
    """Modules newly included by a plan start switched on; existing choices are kept."""
    existing = set((await db.scalars(select(SchoolModule.module).where(SchoolModule.school_id == school_id))).all())
    for m in plan.modules:
        if m not in existing:
            db.add(SchoolModule(school_id=school_id, module=m, is_enabled=True))


async def apply_plan(db: AsyncSession, school: School, plan: Plan, *, cycle: str, status: str,
                     actor_id: uuid.UUID | None) -> School:
    problem = _fits(await usage(db, school.id), plan)
    if problem:
        raise Conflict(f"This plan is too small: {problem}.", code="PLAN_TOO_SMALL")
    old_code = school.plan.code if school.plan else None
    school.plan_id = plan.id
    school.plan = plan
    school.billing_cycle = cycle
    school.subscription_status = status
    if status == "active":
        school.trial_ends_at = None
        school.current_period_end = _now() + timedelta(days=365 if cycle == "yearly" else 30)
    await _enable_plan_modules(db, school.id, plan)
    await audit_service.record(db, "billing.plan_change", school_id=school.id, user_id=actor_id,
                               entity_type="plan", entity_id=plan.code, meta={"from": old_code, "to": plan.code, "cycle": cycle})
    await db.flush()
    return school


def subscription_view(school: School, used: dict[str, int]) -> dict:
    now = _now()
    trial_active = school.subscription_status == "trialing" and bool(school.trial_ends_at and school.trial_ends_at > now)
    return {
        "plan": school.plan,
        "status": school.subscription_status,
        "billing_cycle": school.billing_cycle,
        "trial_ends_at": school.trial_ends_at,
        "trial_days_left": max(0, (school.trial_ends_at - now).days + 1) if trial_active else 0,
        "trial_expired": school.subscription_status == "trialing" and not trial_active,
        "current_period_end": school.current_period_end,
        "can_self_change": trial_active,
        "usage": used,
    }


# ---- self-service sign-up ---------------------------------------------------------------

async def signup(db: AsyncSession, data, *, ip: str | None) -> tuple[School, User]:
    """Creates a school on a 14-day trial with its first admin. `data` is a SignupRequest."""
    await set_tenant(db, None, bypass=True)
    if await db.scalar(select(School.id).where(School.slug == data.school_slug)):
        raise Conflict("That school ID is already taken. Try another.", code="SLUG_TAKEN")

    if data.plan_code == "custom":
        try:
            q = pricing.quote(data.custom_modules or [], data.custom_students or 0)
        except ValueError as e:
            raise BadRequest(str(e), code="INVALID_CUSTOM_PLAN")
        plan = await create_custom_plan(db, q, data.school_slug)
    else:
        plan = await plan_by_code(db, data.plan_code)

    school = School(
        name=data.school_name, slug=data.school_slug, city=data.city, phone=data.phone, email=data.email.lower(),
        plan=plan, subscription_status="trialing", billing_cycle=data.billing_cycle,
        trial_ends_at=_now() + timedelta(days=pricing.TRIAL_DAYS),
    )
    db.add(school)
    await db.flush()
    admin = User(school_id=school.id, email=data.email.lower(), full_name=data.full_name, phone=data.phone,
                 role=Role.SCHOOL_ADMIN, password_hash=hash_password(data.password))
    db.add(admin)
    await _enable_plan_modules(db, school.id, plan)
    await db.flush()
    await audit_service.record(db, "school.signup", school_id=school.id, user_id=admin.id, ip=ip,
                               entity_type="plan", entity_id=plan.code)
    return school, admin


# ---- leads -------------------------------------------------------------------------------

async def create_lead(db: AsyncSession, *, kind: str, ip: str | None, **fields) -> Lead:
    lead = Lead(kind=kind, ip_address=ip, **fields)
    async with elevated(db):  # leads are platform data (bypass-only RLS)
        db.add(lead)
        await db.flush()
    return lead


async def list_leads(db: AsyncSession, *, status: str | None, kind: str | None, page) -> tuple[list[Lead], int]:
    stmt = select(Lead)
    if status:
        stmt = stmt.where(Lead.status == status)
    if kind:
        stmt = stmt.where(Lead.kind == kind)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = await db.scalars(stmt.order_by(Lead.created_at.desc()).offset(page.offset).limit(page.page_size))
    return list(rows.all()), total
