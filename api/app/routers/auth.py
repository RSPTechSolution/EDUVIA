from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.base import ApiResponse
from app.services import auth_service
from app.core.dependencies import get_current_user
from app.core.exceptions import UnauthorizedException

router = APIRouter()

@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.login(db, body.email, body.password, body.school_slug)
        return ApiResponse(data=result)
    except UnauthorizedException as e:
        raise HTTPException(status_code=401, detail=e.message)

@router.post("/logout")
async def logout(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    await auth_service.logout(db, current_user.id)
    return ApiResponse(data={"message": "Logged out"})

@router.post("/refresh", response_model=ApiResponse)
async def refresh(body: dict, db: AsyncSession = Depends(get_db)):
    result = await auth_service.refresh_token(db, body.get("refresh_token"))
    return ApiResponse(data=result)

@router.get("/me", response_model=ApiResponse)
async def me(current_user=Depends(get_current_user)):
    # Create dictionary representing the user schema to pass Pydantic serialization
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "school_id": current_user.school_id,
        "is_active": current_user.is_active
    }
    return ApiResponse(data=user_dict)
