"""Platform operations: health, backups and restore, school export, platform settings and banner."""
import csv
import io
import zipfile
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.models import User
from app.services import backup_service
from tests import factories
from tests.factories import API, PASSWORD


async def test_health_is_for_the_super_admin(client, admin_headers, super_headers):
    assert (await client.get(f"{API}/platform/health", headers=admin_headers)).status_code == 403
    h = (await client.get(f"{API}/platform/health", headers=super_headers)).json()["data"]
    assert h["database"]["ok"] and h["redis"]["ok"] and h["database"]["revision"]
    assert h["providers"]["email"] == "console" and h["usage"]["schools"] >= 1 and "free_gb" in h["storage"]


async def test_backup_and_restore(client, db, school, admin_headers, super_headers):
    for p in backup_service.backup_dir().iterdir():
        p.unlink()
    await factories.user(db, school, "keep@t.com", "teacher")
    assert (await client.post(f"{API}/platform/backups", headers=admin_headers)).status_code == 403
    m = (await client.post(f"{API}/platform/backups", headers=super_headers)).json()["data"]
    assert m["tables"]["users"] >= 2 and m["revision"] and "user_sessions" not in m["tables"]
    listed = (await client.get(f"{API}/platform/backups", headers=super_headers)).json()["data"]
    assert [b["name"] for b in listed] == [m["name"]]
    dl = await client.get(f"{API}/platform/backups/{m['name']}", headers=super_headers)
    assert dl.status_code == 200 and zipfile.ZipFile(io.BytesIO(dl.content)).read("manifest.json")
    assert (await client.get(f"{API}/platform/backups/..%2F.env", headers=super_headers)).status_code == 404

    # Lose a user, then restore: they're back.
    await db.execute(delete(User).where(User.email == "keep@t.com"))
    await db.commit()
    await backup_service.restore_backup(backup_service.path_of(m["name"]))
    db.expire_all()
    assert await db.scalar(select(User.id).where(User.email == "keep@t.com"))
    # Sessions aren't backed up, so everyone signs in again after a restore.
    assert (await client.get(f"{API}/auth/me", headers=admin_headers)).status_code == 401

    backup_service.prune(keep=0)
    assert backup_service.list_backups() == []


async def test_school_exports_only_its_own_data(client, db, school, other_school, admin_headers):
    await factories.user(db, other_school, "stranger@t.com", "teacher")
    await factories.user(db, school, "mine@t.com", "teacher")
    t = await factories.login_headers(client, "mine@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/schools/current/export", headers=t)).status_code == 403
    r = await client.get(f"{API}/schools/current/export", headers=admin_headers)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    users = list(csv.DictReader(io.StringIO(z.read("users.csv").decode())))
    emails = {u["email"] for u in users}
    assert "mine@t.com" in emails and "stranger@t.com" not in emails
    assert all(not u["password_hash"] for u in users)
    assert len(list(csv.DictReader(io.StringIO(z.read("schools.csv").decode())))) == 1 and "user_sessions.csv" not in z.namelist()


async def test_platform_settings_and_banner(client, admin_headers, super_headers):
    assert (await client.put(f"{API}/platform/settings", headers=admin_headers, json={})).status_code == 403
    body = {"product_name": "EDUVIA", "support_email": "help@eduvia.in", "support_phone": "+91 98140 00000",
            "banner": {"text": "Scheduled maintenance on Sunday 2–3 am", "tone": "warning"}}
    assert (await client.put(f"{API}/platform/settings", headers=super_headers, json=body)).status_code == 200
    pub = (await client.get(f"{API}/public/platform")).json()["data"]
    assert pub["support_email"] == "help@eduvia.in" and pub["banner"]["text"].startswith("Scheduled") and pub["banner"]["tone"] == "warning"
    body["banner"]["until"] = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    await client.put(f"{API}/platform/settings", headers=super_headers, json=body)
    assert (await client.get(f"{API}/public/platform")).json()["data"]["banner"] is None
    assert (await client.put(f"{API}/platform/settings", headers=super_headers, json={**body, "banner": {"text": "x", "tone": "pink"}})).status_code == 422


async def test_school_brand_colour(client, admin_headers):
    bad = await client.patch(f"{API}/schools/current", headers=admin_headers, json={"settings": {"brand_color": "#ff00ff"}})
    assert bad.status_code == 422
    assert (await client.patch(f"{API}/schools/current", headers=admin_headers, json={"settings": {"brand_color": "#0f766e"}})).status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=admin_headers)).json()["data"]["school"]["brand_color"] == "#0f766e"
