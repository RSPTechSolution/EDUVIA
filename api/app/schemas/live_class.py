import uuid
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class LiveClassCreate(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    topic: str
    start_time: datetime
    duration_minutes: int
    platform: str = "zoom"
