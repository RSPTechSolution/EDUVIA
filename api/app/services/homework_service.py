import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.academics import Homework
from app.schemas.academics import HomeworkCreate

async def create_homework(db: AsyncSession, school_id: uuid.UUID, teacher_id: uuid.UUID, data: HomeworkCreate):
    hw = Homework(**data.model_dump(), school_id=school_id, teacher_id=teacher_id)
    db.add(hw)
    await db.commit()
    await db.refresh(hw)
    return hw
