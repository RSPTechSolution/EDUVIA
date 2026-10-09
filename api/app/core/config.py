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
    OTP_EXPIRE_MINUTES: int = 10
    OTP_DEBUG: bool = False  # outside production, return the sign-in code in the response (local testing only)
    BCRYPT_ROUNDS: int = 12

    LOGIN_RATE_LIMIT: int = 10           # attempts ...
    LOGIN_RATE_WINDOW_SECONDS: int = 900 # ... per 15 minutes per (ip, email)
    SIGNUP_RATE_LIMIT: int = 5           # school sign-ups per hour per IP
    CONTACT_RATE_LIMIT: int = 10         # contact/quote messages per hour per IP

    # Email: "console" logs messages instead of sending (development, tests); "brevo" sends.
    # A Brevo key starting xkeysib- uses Brevo's HTTP API; an SMTP key (xsmtpsib-) uses the SMTP relay
    # and needs BREVO_SMTP_LOGIN.
    EMAIL_PROVIDER: str = "console"
    BREVO_API_KEY: str = ""
    BREVO_SMTP_LOGIN: str = ""
    BREVO_SMTP_HOST: str = "smtp-relay.brevo.com"
    BREVO_SMTP_PORT: int = 587
    EMAIL_FROM: str = "no-reply@eduvia.local"
    EMAIL_FROM_NAME: str = "EDUVIA"
    EMAIL_DAILY_LIMIT: int = 300  # Brevo's free plan
    # Never send to these domains: the demo data and tests use them, and demo.com is someone else's.
    EMAIL_SKIP_DOMAINS: Annotated[list[str], NoDecode] = ["demo.com", "students.demo.com", "example.com", "t.com", "eduvia.local"]

    # Uploaded files are kept on disk under STORAGE_DIR (one folder per school).
    STORAGE_DIR: str = "storage"
    MAX_UPLOAD_MB: int = 10

    # Push notifications: "console" logs them; "fcm" sends through Firebase Cloud Messaging using the
    # service-account JSON file at FIREBASE_CREDENTIALS_FILE. In-app notifications work either way.
    # SMS and WhatsApp. "console" logs them (and records them in Settings > Messages) without sending.
    SMS_PROVIDER: str = "console"  # console | twilio | msg91
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM: str = ""
    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = ""
    WHATSAPP_PROVIDER: str = "console"  # console | meta (WhatsApp Cloud API)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""

    PUSH_PROVIDER: str = "console"
    FIREBASE_CREDENTIALS_FILE: str = ""

    # Public address of this API, used in short-lived download links opened by the mobile apps.
    API_PUBLIC_URL: str = "http://localhost:8000"

    # Online fee payments: "test" simulates a gateway (never allowed in production),
    # "none" turns online payment off. Real gateways (Razorpay) plug in here later.
    PAYMENT_GATEWAY: str = "test"

    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    APP_URL: str = "http://localhost:3000"

    @field_validator("EMAIL_SKIP_DOMAINS", mode="before")
    @classmethod
    def _split_domains(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [d.strip().lower() for d in v.split(",") if d.strip()]
        return v

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
        if self.EMAIL_PROVIDER == "brevo" and not self.BREVO_API_KEY:
            raise ValueError("EMAIL_PROVIDER=brevo needs BREVO_API_KEY")
        if self.EMAIL_PROVIDER == "brevo" and self.BREVO_API_KEY.startswith("xsmtpsib-") and not self.BREVO_SMTP_LOGIN:
            raise ValueError("A Brevo SMTP key needs BREVO_SMTP_LOGIN (shown next to the key in Brevo)")
        if self.PUSH_PROVIDER == "fcm" and not self.FIREBASE_CREDENTIALS_FILE:
            raise ValueError("PUSH_PROVIDER=fcm needs FIREBASE_CREDENTIALS_FILE (the Firebase service-account JSON)")
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
