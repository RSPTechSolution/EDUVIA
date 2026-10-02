from fastapi import Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings
from jose import jwt, JWTError
from app.models.user import User
from sqlalchemy import select

async def get_db_session(request: Request, current_user=None) -> AsyncSession:
    async for session in get_db():
        if current_user and current_user.school_id:
            await session.execute(
                text("SET LOCAL app.current_school_id = :sid"),
                {"sid": str(current_user.school_id)}
            )
        yield session

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.scalar(select(User).where(User.id == user_id))
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
