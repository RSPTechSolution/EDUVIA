from functools import lru_cache
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "EDUVIA"
    ENVIRONMENT: str = "development"  # development | test | production
    DEBUG: bool = False

    # Runtime connection uses the non-owner role so row-level security applies.
    DATABASE_URL: str = "postgresql+asyncpg://eduvia_app:eduvia_app_dev@localhost:5433/eduvia"
    # Owner connection, used only by Alembic and test setup.
    MIGRATION_DATABASE_URL: str = "postgresql+asyncpg://eduvia:eduvia_owner_dev@localhost:5433/eduvia"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    REDIS_URL: str = "redis://localhost:6380/0"

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    BCRYPT_ROUNDS: int = 12

    LOGIN_RATE_LIMIT: int = 10           # attempts ...
    LOGIN_RATE_WINDOW_SECONDS: int = 900 # ... per 15 minutes per (ip, email)
    SIGNUP_RATE_LIMIT: int = 5           # school sign-ups per hour per IP
    CONTACT_RATE_LIMIT: int = 10         # contact/quote messages per hour per IP

    # Online fee payments: "test" simulates a gateway (never allowed in production),
    # "none" turns online payment off. Real gateways (Razorpay) plug in here later.
    PAYMENT_GATEWAY: str = "test"

    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    APP_URL: str = "http://localhost:3000"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _check_secrets(self):
        if len(self.JWT_SECRET_KEY) < 32:
            raise ValueError("JWT_SECRET_KEY must be set and at least 32 characters long")
        if self.ENVIRONMENT == "production" and self.DEBUG:
            raise ValueError("DEBUG must be false in production")
        if self.ENVIRONMENT == "production" and self.PAYMENT_GATEWAY == "test":
            raise ValueError("PAYMENT_GATEWAY=test is for development only")
        return self

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT == "test"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
