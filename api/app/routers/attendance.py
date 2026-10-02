from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import get_db, get_redis
from app.core.dependencies import get_current_user
from app.models.attendance import AttendanceRecord, QrScanLog
from app.models.academics import Student
from app.schemas.attendance import QrScanRequest, BulkAttendanceRequest
from app.schemas.base import ApiResponse
from datetime import date
from redis.asyncio import Redis
import uuid

router = APIRouter()

@router.get("/devices")
async def get_devices(db: AsyncSession = Depends(get_db)):
    return ApiResponse(data=[])

@router.get("/calendar")
async def get_calendar(db: AsyncSession = Depends(get_db)):
    return ApiResponse(data=[])

@router.post("/qr-scan")
async def qr_scan(
    body: QrScanRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user = Depends(get_current_user),
):
    cache_key = f"qr_scan:{body.student_id}:{body.mode}"
    if await redis.get(cache_key):
        raise HTTPException(status_code=429, detail={"code": "ALREADY_SCANNED", "message": "Student already scanned within 10 minutes"})

    student = await db.scalar(select(Student).where(Student.id == body.student_id))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    record = AttendanceRecord(
        school_id=current_user.school_id,
        student_id=body.student_id,
        section_id=student.section_id,
        date=date.today(),
        status="present",
        method="qr_scan",
        marked_by=current_user.id,
    )
    db.add(record)
    scan_log = QrScanLog(
        school_id=current_user.school_id, 
        student_id=body.student_id,
        scanned_by=current_user.id, 
        mode=body.mode
    )
    db.add(scan_log)
    await db.commit()
    await redis.setex(cache_key, 600, "1")

    return ApiResponse(data={"student": student, "status": "marked_present"})

@router.post("/{section_id}")
async def bulk_attendance_mark(
    section_id: uuid.UUID,
    body: BulkAttendanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    for r in body.records:
        existing = await db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.student_id == r.student_id,
                AttendanceRecord.date == body.date,
                AttendanceRecord.period == None
            )
        )
        if existing:
            existing.status = r.status
            existing.marked_by = current_user.id
            existing.method = "manual"
        else:
            record = AttendanceRecord(
                school_id=current_user.school_id,
                student_id=r.student_id,
                section_id=section_id,
                date=body.date,
                status=r.status,
                method="manual",
                marked_by=current_user.id
            )
            db.add(record)
    
    await db.commit()
    return ApiResponse(data={"saved": len(body.records)})
