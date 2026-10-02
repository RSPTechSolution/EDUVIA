from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import date, datetime

class QrScanRequest(BaseModel):
    student_id: UUID
    mode: str

class AttendanceRecordCreate(BaseModel):
    student_id: UUID
    status: str

class BulkAttendanceRequest(BaseModel):
    date: date
    records: List[AttendanceRecordCreate]
