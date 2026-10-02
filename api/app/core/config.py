from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://schoolerp:secret@localhost:5433/schoolerp"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str = "supersecretkey1234567890123456789012345678901234567890123456789012"
    JWT_REFRESH_SECRET_KEY: str = "supersecretrefreshkey123456789012345678901234567890123456789012"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
