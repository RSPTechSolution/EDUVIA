import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.academics import Timetable
from app.schemas.academics import TimetableCreate

async def update_timetable(db: AsyncSession, school_id: uuid.UUID, section_id: uuid.UUID, body: TimetableCreate):
    # Check for teacher clash
    for slot in body.slots:
        clash = await db.scalar(
            select(Timetable).where(
                Timetable.school_id == school_id,
                Timetable.teacher_id == slot.teacher_id,
                Timetable.day_of_week == slot.day_of_week,
                Timetable.period == slot.period,
                Timetable.section_id != section_id
            )
        )
        if clash:
            return {"error": {"code": "TEACHER_CLASH", "message": "Teacher already assigned at this time"}}
    
    # Simple implementation: delete old slots for section, add new
    await db.execute(Timetable.__table__.delete().where(Timetable.section_id == section_id))
    for slot in body.slots:
        tt = Timetable(**slot.model_dump(), school_id=school_id, section_id=section_id)
        db.add(tt)
    
    await db.commit()
    return {"message": "Timetable updated"}
