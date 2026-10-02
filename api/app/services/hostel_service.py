import uuid
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from app.models.hostel import HostelRoom, HostelAllocation
from fastapi import HTTPException

class BadRequestException(HTTPException):
    def __init__(self, detail: dict):
        super().__init__(status_code=400, detail=detail)

async def allocate_hostel_room(db: AsyncSession, room_id: uuid.UUID, student_id: uuid.UUID):
    room = await db.get(HostelRoom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    current_occupants = await db.scalar(
        select(func.count()).where(
            HostelAllocation.room_id == room_id,
            HostelAllocation.allocated_to.is_(None),
        )
    )
    if current_occupants >= room.capacity:
        raise BadRequestException(detail={"code": "ROOM_FULL", "message": f"Room capacity ({room.capacity}) reached"})
        
    allocation = HostelAllocation(student_id=student_id, room_id=room_id, allocated_from=date.today())
    db.add(allocation)
    await db.commit()
    return allocation
