import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.core.errors import install_error_handlers
from app.core.permissions import MODULES
from app.core.redis import close_redis, get_redis
from app.routers import auth, schools, users
from app.schemas.common import ok

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title=f"{settings.APP_NAME} API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
install_error_handlers(app)

API = "/api/v1"
app.include_router(auth.router, prefix=f"{API}/auth", tags=["Auth"])
app.include_router(schools.router, prefix=f"{API}/schools", tags=["Schools"])
app.include_router(users.router, prefix=f"{API}/users", tags=["Users"])


@app.get(f"{API}/health", tags=["Meta"])
async def health():
    checks = {}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
    try:
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
    return ok({"status": "ok" if all(v == "ok" for v in checks.values()) else "degraded", **checks})


@app.get(f"{API}/meta/modules", tags=["Meta"])
async def module_registry():
    return ok([{"module": k, "label": v["label"], "default": v["default"]} for k, v in MODULES.items()])
