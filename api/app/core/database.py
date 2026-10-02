# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import declarative_base
from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# pyrefly: ignore [missing-import]
import redis.asyncio as redis
async def get_redis():
    client = redis.from_url(settings.REDIS_URL)
    try:
        yield client
    finally:
        await client.aclose()
