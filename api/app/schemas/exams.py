from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uuid
from datetime import datetime

class QuestionCreate(BaseModel):
    subject_id: uuid.UUID
    type: str
    difficulty: str = "medium"
    topic: Optional[str] = None
    content: Dict[str, Any]
    marks: int = 1
    explanation: Optional[str] = None

class OnlineExamCreate(BaseModel):
    title: str
    mode: str
    section_id: uuid.UUID
    question_ids: List[uuid.UUID]
    duration_minutes: int
    shuffle_questions: bool = False
    shuffle_options: bool = False

class AutosaveRequest(BaseModel):
    answers: Dict[str, Any]

class SubmitRequest(BaseModel):
    final_answers: Dict[str, Any]
