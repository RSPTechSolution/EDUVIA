from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    school_id: Optional[UUID] = None

class UserOut(BaseModel):
    id: UUID
    email: str
    role: str
    school_id: Optional[UUID]
    is_active: bool
    model_config = {"from_attributes": True}
