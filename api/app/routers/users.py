from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.schemas.user import UserCreate, UserOut
from app.schemas.base import ApiResponse
from app.models.user import User
from app.services.auth_service import hash_password
from app.core.permissions import require_permission
import uuid

router = APIRouter()

@router.get("/", response_model=ApiResponse[list[UserOut]], dependencies=[Depends(require_permission("users.manage"))])
async def get_users(db: AsyncSession = Depends(get_db)):
    users = await db.scalars(select(User))
    return ApiResponse(data=list(users))

@router.post("/", response_model=ApiResponse[UserOut], dependencies=[Depends(require_permission("users.manage"))])
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    user_dict = body.model_dump()
    user_dict["password_hash"] = hash_password(user_dict.pop("password"))
    user = User(**user_dict)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return ApiResponse(data=user)
