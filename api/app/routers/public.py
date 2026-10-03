"""Unauthenticated endpoints used by the public website."""
from fastapi import APIRouter, Request

from app.core import pricing, ratelimit
from app.core.deps import DB, client_ip
from app.core.errors import BadRequest, TooManyRequests
from app.core.permissions import MODULES
from app.schemas.billing import (
    ContactRequest, ModulePrice, PlanBrief, PlanOut, PricingCatalog, QuoteOut, QuoteRequest, SignupOut, SignupRequest,
)
from app.schemas.common import ApiResponse, Message, ok
from app.services import billing_service

router = APIRouter()


async def _limit(request: Request, bucket: str, limit: int, window: int) -> None:
    if not await ratelimit.hit(f"rl:{bucket}:{client_ip(request)}", limit, window):
        raise TooManyRequests("Too many requests. Please try again later.", code="RATE_LIMITED")


@router.get("/plans", response_model=ApiResponse[list[PlanOut]])
async def plans(db: DB):
    return ok([PlanOut.model_validate(p) for p in await billing_service.public_plans(db)])


@router.get("/pricing", response_model=ApiResponse[PricingCatalog])
async def pricing_catalog():
    lower, tiers = 0, []
    for upper, rate in pricing.STUDENT_TIERS:
        tiers.append({"from": lower + 1, "to": upper, "per_student": rate})
        lower = upper
    return ok(PricingCatalog(
        gst_rate=pricing.GST_RATE,
        trial_days=pricing.TRIAL_DAYS,
        yearly_months_charged=pricing.YEARLY_MONTHS_CHARGED,
        platform_fee=pricing.PLATFORM_FEE,
        modules=[ModulePrice(module=k, label=v["label"], monthly=pricing.MODULE_PRICES[k], core=k in pricing.CORE_MODULES)
                 for k, v in MODULES.items()],
        student_tiers=tiers,
        min_students=pricing.MIN_STUDENTS,
        max_students=pricing.MAX_SELF_SERVE_STUDENTS,
    ))


@router.post("/quote", response_model=ApiResponse[QuoteOut])
async def quote(body: QuoteRequest):
    try:
        q = pricing.quote(body.modules, body.students)
    except ValueError as e:
        raise BadRequest(str(e), code="INVALID_CUSTOM_PLAN")
    return ok(QuoteOut(**q.__dict__))


@router.post("/signup", response_model=ApiResponse[SignupOut], status_code=201)
async def signup(body: SignupRequest, request: Request, db: DB):
    await _limit(request, "signup", 5, 3600)
    school, admin = await billing_service.signup(db, body, ip=client_ip(request))
    return ok(SignupOut(school_slug=school.slug, email=admin.email,
                        plan=PlanBrief.model_validate(school.plan), trial_ends_at=school.trial_ends_at))


@router.post("/contact", response_model=ApiResponse[Message], status_code=201)
async def contact(body: ContactRequest, request: Request, db: DB):
    await _limit(request, "contact", 10, 3600)
    quoted = None
    kind = "contact"
    if body.students and body.modules is not None:
        kind = "quote"
        try:
            quoted = pricing.quote(body.modules, body.students).monthly
        except ValueError:
            quoted = None  # e.g. more students than self-serve: still worth a conversation
    await billing_service.create_lead(
        db, kind=kind, ip=client_ip(request), name=body.name, email=body.email.lower(), phone=body.phone,
        school_name=body.school_name, message=body.message, students=body.students,
        modules=body.modules or [], quoted_monthly=quoted,
    )
    return ok(Message(message="Thanks! Our team will get back to you within one business day."))
