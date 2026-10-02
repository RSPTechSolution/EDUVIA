from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.school import School
from app.models.user import User, UserSession
from app.core.config import settings
from app.core.exceptions import UnauthorizedException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({**data, "exp": expire}, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

async def login(db: AsyncSession, email: str, password: str, school_slug: str | None):
    school_id = None
    if school_slug:
        school = await db.scalar(select(School).where(School.slug == school_slug))
        if not school:
            raise UnauthorizedException("Invalid credentials")
        school_id = school.id

    stmt = select(User).where(
        User.email == email,
        User.is_active == True,
        User.deleted_at == None,
    )
    if school_id:
        stmt = stmt.where(User.school_id == school_id)

    user = await db.scalar(stmt)
    if not user or not verify_password(password, user.password_hash):
        raise UnauthorizedException("Invalid credentials")

    payload = {"sub": str(user.id), "school_id": str(user.school_id) if user.school_id else None, "role": user.role}
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token({"sub": str(user.id)})

    session = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return {"tokens": {"access_token": access_token, "refresh_token": refresh_token}, "user": user}

async def logout(db: AsyncSession, user_id):
    # Just a placeholder for actual session cleanup
    await db.execute(
        select(UserSession).where(UserSession.user_id == user_id)
    )
    await db.commit()

async def refresh_token(db: AsyncSession, refresh_token: str):
    pass # Implementation for refresh token
