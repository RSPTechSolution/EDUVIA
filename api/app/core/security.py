import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings
from app.core.errors import Unauthorized

MAX_PASSWORD_BYTES = 72  # bcrypt limit


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    if len(pw) > MAX_PASSWORD_BYTES:
        raise ValueError("Password too long")
    return bcrypt.hashpw(pw, bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode()


def verify_password(password: str, hashed: str) -> bool:
    pw = password.encode("utf-8")
    if len(pw) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(pw, hashed.encode())
    except ValueError:
        return False


# A hash of a random password, so failed logins for unknown users cost the same time.
DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode()


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(*, user_id: uuid.UUID, session_id: uuid.UUID, school_id: uuid.UUID | None, role: str) -> tuple[str, int]:
    now = datetime.now(UTC)
    ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "sch": str(school_id) if school_id else None,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM), ttl


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM],
                             options={"require": ["exp", "sub", "sid", "type"]})
    except jwt.ExpiredSignatureError:
        raise Unauthorized("Access token expired", code="TOKEN_EXPIRED")
    except jwt.PyJWTError:
        raise Unauthorized("Invalid token", code="INVALID_TOKEN")
    if payload.get("type") != "access":
        raise Unauthorized("Invalid token", code="INVALID_TOKEN")
    return payload
