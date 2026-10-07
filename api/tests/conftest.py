import os

# Must be set before the app is imported.
os.environ.update(
    ENVIRONMENT="test",
    DEBUG="false",
    DATABASE_URL="postgresql+asyncpg://eduvia_app:eduvia_app_dev@localhost:5433/eduvia_test",
    MIGRATION_DATABASE_URL="postgresql+asyncpg://eduvia:eduvia_owner_dev@localhost:5433/eduvia_test",
    REDIS_URL="redis://localhost:6380/15",
    JWT_SECRET_KEY="test-only-secret-key-that-is-long-enough-0123456789",
    BCRYPT_ROUNDS="4",
    EMAIL_PROVIDER="console",  # tests never send real email
)

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import make_engine, system_session  # noqa: E402
from app.core.redis import get_redis  # noqa: E402
from app.main import app  # noqa: E402
from app.core.pricing import PRESET_PLANS  # noqa: E402
from app.models import Base, Plan  # noqa: E402
from tests import factories  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    """Rebuild the test schema from migrations (also exercises downgrade)."""
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "migrations"))
    cfg.attributes["url"] = settings.MIGRATION_DATABASE_URL
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
async def clean_state(migrated_db):
    yield
    owner = make_engine(settings.MIGRATION_DATABASE_URL, null_pool=True)
    tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    async with owner.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        # Preset plans are reference data inserted by migration 0002: restore them.
        await conn.execute(Plan.__table__.insert(), [
            {**p, "is_public": True, "is_custom": False, "is_active": True} for p in PRESET_PLANS
        ])
    await owner.dispose()
    await get_redis().flushdb()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db():
    """A bypass-RLS session for arranging/inspecting test data."""
    async with system_session() as s:
        yield s


@pytest.fixture
async def school(db):
    return await factories.school(db, "alpha")


@pytest.fixture
async def other_school(db):
    return await factories.school(db, "beta")


@pytest.fixture
async def admin(db, school):
    return await factories.user(db, school, "admin@alpha.edu", "school_admin")


@pytest.fixture
async def admin_headers(client, admin):
    return await factories.login_headers(client, admin.email, factories.PASSWORD, "alpha")


@pytest.fixture
async def super_admin(db):
    return await factories.user(db, None, "root@eduvia.edu", "super_admin")


@pytest.fixture
async def super_headers(client, super_admin):
    return await factories.login_headers(client, super_admin.email, factories.PASSWORD, None)
