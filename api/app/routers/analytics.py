"""School analytics."""
from datetime import date

from fastapi import APIRouter, Query

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.core.errors import BadRequest
from app.schemas.analytics import AnalyticsReport
from app.schemas.common import ApiResponse, ok
from app.services import analytics_service as svc

router = APIRouter(dependencies=[require_module("analytics")])


@router.get("", response_model=ApiResponse[AnalyticsReport])
async def report(db: DB, frm: date | None = Query(None, alias="from"), to: date | None = None, current: CurrentUser = require_permission("analytics.view")):
    current.require_school()
    if frm and to and (to < frm or (to - frm).days > 400):
        raise BadRequest("Pick a range of up to about a year", code="BAD_RANGE")
    return ok(await svc.report(db, current.user, frm, to))
