from celery import shared_task
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.attendance import BiometricPunch, AttendanceRecord
from app.models.academics import Student
import asyncio
import uuid

@shared_task
def process_biometric_punches(device_id: str, school_id: str):
    asyncio.run(_process(device_id, school_id))

async def _process(device_id: str, school_id: str):
    async with AsyncSessionLocal() as db:
        punches = await db.scalars(
            select(BiometricPunch).where(
                BiometricPunch.device_id == device_id,
                BiometricPunch.processed == False,
            ).order_by(BiometricPunch.punch_time)
        )
        for punch in punches.all():
            student = await db.scalar(select(Student).where(Student.admission_no == punch.person_id, Student.school_id == uuid.UUID(school_id)))
            if student:
                punch_date = punch.punch_time.date()
                existing = await db.scalar(
                    select(AttendanceRecord).where(
                        AttendanceRecord.student_id == student.id,
                        AttendanceRecord.date == punch_date,
                        AttendanceRecord.period == None,
                    )
                )
                if not existing:
                    record = AttendanceRecord(
                        school_id=uuid.UUID(school_id),
                        student_id=student.id,
                        section_id=student.section_id,
                        date=punch_date,
                        status="present",
                        method="biometric",
                        marked_by=student.id, # In a real app this would be a system ID
                    )
                    db.add(record)
            punch.processed = True
        await db.commit()
