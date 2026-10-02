from pydantic import BaseModel
from uuid import UUID
from typing import Optional

class SchoolCreate(BaseModel):
    name: str
    slug: str
    domain: Optional[str] = None
    timezone: str = "Asia/Kolkata"

class SchoolOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    model_config = {"from_attributes": True}
