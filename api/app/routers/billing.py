"""A school's own subscription: current plan, usage, changing plan."""
from fastapi import APIRouter

from app.core import pricing
from app.core.deps import DB, CurrentUser, require_permission
from app.core.errors import BadRequest
from app.schemas.billing import ChangePlanOut, ChangePlanRequest, PlanOut, SubscriptionOut
from app.schemas.common import ApiResponse, ok
from app.services import billing_service, school_service

router = APIRouter()


async def _subscription(db, school_id) -> SubscriptionOut:
    school = await school_service.get_school(db, school_id)
    view = billing_service.subscription_view(school, await billing_service.usage(db, school_id))
    return SubscriptionOut(
        **{**view, "plan": PlanOut.model_validate(view["plan"])},
        available_plans=[PlanOut.model_validate(p) for p in await billing_service.public_plans(db)],
    )


@router.get("", response_model=ApiResponse[SubscriptionOut])
async def get_subscription(db: DB, current: CurrentUser = require_permission("billing.view")):
    return ok(await _subscription(db, current.require_school()))


@router.post("/change", response_model=ApiResponse[ChangePlanOut])
async def change_plan(body: ChangePlanRequest, db: DB, current: CurrentUser = require_permission("billing.manage")):
    """During the free trial the change applies immediately. Afterwards it is sent
    to the EDUVIA team as a request (online payment is not connected yet)."""
    school_id = current.require_school()
    school = await school_service.get_school(db, school_id)
    view = billing_service.subscription_view(school, await billing_service.usage(db, school_id))

    custom_quote = None
    if body.plan_code == "custom":
        try:
            custom_quote = pricing.quote(body.custom_modules or [], body.custom_students or 0)
        except ValueError as e:
            raise BadRequest(str(e), code="INVALID_CUSTOM_PLAN")

    if not view["can_self_change"]:
        await billing_service.create_lead(
            db, kind="upgrade", ip=None, name=current.user.full_name, email=current.user.email,
            phone=current.user.phone, school_name=school.name, message=body.message,
            plan_code=body.plan_code, from_school_id=school_id,
            students=custom_quote.students if custom_quote else None,
            modules=custom_quote.modules if custom_quote else [],
            quoted_monthly=custom_quote.monthly if custom_quote else None,
        )
        return ok(ChangePlanOut(changed=False, message="Request sent. The EDUVIA team will contact you to complete the change."))

    if custom_quote:
        plan = await billing_service.create_custom_plan(db, custom_quote, school.slug)
    else:
        plan = await billing_service.plan_by_code(db, body.plan_code)
    await billing_service.apply_plan(db, school, plan, cycle=body.billing_cycle, status="trialing", actor_id=current.id)
    return ok(ChangePlanOut(changed=True, message=f"You're now on the {plan.name} plan.",
                            subscription=await _subscription(db, school_id)))
