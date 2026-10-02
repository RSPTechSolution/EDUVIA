import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db_session, get_current_user
from app.models.user import User
from app.models.live_class import LiveClass
from app.schemas.live_class import LiveClassCreate

router = APIRouter(prefix="/api/v1/live-classes", tags=["live-classes"])

@router.post("/")
async def create_live_class(
    data: LiveClassCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    # Mocking external API call to Zoom/Meet
    meeting_url = f"https://{data.platform}.us/j/{uuid.uuid4().hex[:10]}"
    join_link = f"{meeting_url}?pwd=secret"
    
    live_class = LiveClass(
        school_id=current_user.school_id,
        section_id=data.section_id,
        subject_id=data.subject_id,
        teacher_id=current_user.id,
        topic=data.topic,
        start_time=data.start_time,
        duration_minutes=data.duration_minutes,
        platform=data.platform,
        meeting_url=meeting_url,
        join_link=join_link
    )
    db.add(live_class)
    await db.commit()
    await db.refresh(live_class)
    return {"success": True, "data": live_class}
