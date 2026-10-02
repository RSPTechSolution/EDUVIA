import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db_session, get_current_user
from app.models.user import User
from app.schemas.exams import AutosaveRequest, SubmitRequest
from app.services.exam_service import autosave_attempt, submit_attempt, get_item_analysis

router = APIRouter(prefix="/api/v1/exams", tags=["exams"])

@router.post("/attempts/{attempt_id}/autosave")
async def autosave(
    attempt_id: uuid.UUID,
    data: AutosaveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    try:
        await autosave_attempt(db, attempt_id, data.answers)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/attempts/{attempt_id}/submit")
async def submit(
    attempt_id: uuid.UUID,
    data: SubmitRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    try:
        result = await submit_attempt(db, attempt_id, data.final_answers)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{exam_id}/analysis")
async def item_analysis(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    mock_analysis = [
      { "id": 1, "correct_pct": 85, "wrong_pct": 10, "skip_pct": 5 },
      { "id": 2, "correct_pct": 40, "wrong_pct": 50, "skip_pct": 10 },
      { "id": 3, "correct_pct": 95, "wrong_pct": 2, "skip_pct": 3 },
      { "id": 4, "correct_pct": 20, "wrong_pct": 60, "skip_pct": 20 },
      { "id": 5, "correct_pct": 70, "wrong_pct": 20, "skip_pct": 10 },
    ]
    return {"success": True, "data": mock_analysis}
