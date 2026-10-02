import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db_session, get_current_user
from app.models.user import User
from app.services.survey_service import get_survey_analytics

router = APIRouter(prefix="/api/v1/surveys", tags=["surveys"])

@router.get("/{survey_id}/analytics")
async def get_analytics(
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    try:
        analytics = await get_survey_analytics(db, survey_id)
        return {"success": True, "data": analytics}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
