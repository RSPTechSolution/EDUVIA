from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional, List
from datetime import date, datetime

class StudentCreate(BaseModel):
    section_id: UUID
    admission_no: str
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    
class StudentOut(BaseModel):
    id: UUID
    school_id: UUID
    section_id: UUID
    admission_no: str
    first_name: str
    last_name: str
    status: str
    photo: Optional[str] = None
    gender: Optional[str] = None
    parent_phone: Optional[str] = None
    class_name: Optional[str] = None
    section_name: Optional[str] = None
    model_config = {"from_attributes": True}

class PaginatedStudents(BaseModel):
    items: List[StudentOut]
    total: int

class PromoteRequest(BaseModel):
    student_ids: List[UUID]
    to_section_id: UUID

class TimetableSlot(BaseModel):
    day_of_week: int
    period: int
    subject_id: UUID
    teacher_id: UUID
    start_time: str
    end_time: str

class TimetableCreate(BaseModel):
    slots: List[TimetableSlot]

class HomeworkCreate(BaseModel):
    section_id: UUID
    subject_id: UUID
    title: str
    description: Optional[str] = None
    due_date: datetime
    attachments: List[str] = []
