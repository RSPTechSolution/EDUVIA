from pydantic import BaseModel, EmailStr
from uuid import UUID

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    school_slug: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: UUID
    email: str
    role: str
    school_id: UUID | None
    is_active: bool

    model_config = {"from_attributes": True}

class LoginResponse(BaseModel):
    tokens: TokenResponse
    user: UserOut
