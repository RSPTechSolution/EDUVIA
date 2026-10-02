from httpx import AsyncClient

from app.core.permissions import MODULES
from app.core.security import hash_password
from app.models import School, SchoolModule, User

PASSWORD = "Passw0rd!x"
API = "/api/v1"


async def school(db, slug: str, *, is_active: bool = True) -> School:
    s = School(name=f"{slug.title()} School", slug=slug, is_active=is_active)
    db.add(s)
    await db.flush()
    for m, meta in MODULES.items():
        db.add(SchoolModule(school_id=s.id, module=m, is_enabled=meta["default"]))
    await db.commit()
    return s


async def user(db, school: School | None, email: str, role: str, *, is_active: bool = True,
               password: str = PASSWORD) -> User:
    u = User(school_id=school.id if school else None, email=email, full_name=email.split("@")[0].title(),
             role=role, is_active=is_active, password_hash=hash_password(password))
    db.add(u)
    await db.commit()
    return u


async def login(client: AsyncClient, email: str, password: str, slug: str | None):
    return await client.post(f"{API}/auth/login", json={"email": email, "password": password, "school_slug": slug})


async def login_headers(client: AsyncClient, email: str, password: str, slug: str | None) -> dict:
    res = await login(client, email, password, slug)
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['data']['tokens']['access_token']}"}
