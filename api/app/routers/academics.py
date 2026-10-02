from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.base import ApiResponse, ApiError
from app.schemas.academics import TimetableCreate
from app.services import academics_service
from app.core.permissions import require_permission
from fastapi.responses import JSONResponse
import uuid

router = APIRouter()

@router.put("/timetable/{section_id}")
async def update_timetable(section_id: uuid.UUID, body: TimetableCreate, db: AsyncSession = Depends(get_db), user=Depends(require_permission("schools.manage"))):
    result = await academics_service.update_timetable(db, user.school_id, section_id, body)
    if "error" in result:
        return JSONResponse(status_code=409, content={"success": False, "error": result["error"]})
    return ApiResponse(data=result)

@router.get("/homework")
async def get_homework():
    return ApiResponse(data={"todo": [], "submitted": [], "graded": []})

@router.get("/syllabus")
async def get_syllabus():
    return ApiResponse(data=[])

@router.get("/timetable")
async def get_timetable():
    return ApiResponse(data=[])
