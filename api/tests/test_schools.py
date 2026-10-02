from tests import factories
from tests.factories import API, PASSWORD

NEW_SCHOOL = {"name": "Sunrise Academy", "slug": "sunrise", "timezone": "Asia/Kolkata", "currency": "inr",
              "admin_full_name": "Sunita Rao", "admin_email": "sunita@sunrise.edu", "admin_password": "Start1234"}


async def test_health(client):
    res = await client.get(f"{API}/health")
    assert res.json()["data"] == {"status": "ok", "database": "ok", "redis": "ok"}


async def test_current_school_read_and_update(client, db, school, admin_headers):
    res = await client.get(f"{API}/schools/current", headers=admin_headers)
    assert res.json()["data"]["slug"] == "alpha"
    upd = await client.patch(f"{API}/schools/current", headers=admin_headers,
                             json={"city": "Pune", "settings": {"academic_start_month": 4}})
    assert upd.json()["data"]["city"] == "Pune"
    assert upd.json()["data"]["settings"]["academic_start_month"] == 4
    bad_tz = await client.patch(f"{API}/schools/current", headers=admin_headers, json={"timezone": "Mars/Base"})
    assert bad_tz.status_code == 422

    await factories.user(db, school, "p@alpha.edu", "principal")
    ph = await factories.login_headers(client, "p@alpha.edu", PASSWORD, "alpha")
    assert (await client.patch(f"{API}/schools/current", headers=ph, json={"city": "X"})).status_code == 403


async def test_module_toggle(client, admin_headers):
    modules = (await client.get(f"{API}/schools/current/modules", headers=admin_headers)).json()["data"]
    assert {m["module"]: m["is_enabled"] for m in modules}["library"] is False
    res = await client.put(f"{API}/schools/current/modules/library", headers=admin_headers, json={"is_enabled": True})
    assert res.json()["data"]["is_enabled"] is True
    me = (await client.get(f"{API}/auth/me", headers=admin_headers)).json()["data"]
    assert "library" in me["modules"]
    unknown = await client.put(f"{API}/schools/current/modules/teleport", headers=admin_headers, json={"is_enabled": True})
    assert unknown.status_code == 404


async def test_super_admin_provisions_school(client, super_headers):
    res = await client.post(f"{API}/schools", headers=super_headers, json=NEW_SCHOOL)
    assert res.status_code == 201, res.text
    assert res.json()["data"]["currency"] == "INR"
    login = await factories.login(client, "sunita@sunrise.edu", "Start1234", "sunrise")
    assert login.status_code == 200
    user = login.json()["data"]["user"]
    assert user["role"] == "school_admin" and user["must_change_password"] is True
    assert "students" in user["modules"] and "library" not in user["modules"]

    dup = await client.post(f"{API}/schools", headers=super_headers, json=NEW_SCHOOL)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "SLUG_TAKEN"
    bad_slug = await client.post(f"{API}/schools", headers=super_headers, json={**NEW_SCHOOL, "slug": "Bad Slug!"})
    assert bad_slug.status_code == 422

    listed = await client.get(f"{API}/schools?search=sunrise", headers=super_headers)
    assert listed.json()["meta"]["total"] == 1


async def test_super_admin_can_suspend_school(client, super_headers, school, admin, admin_headers):
    res = await client.patch(f"{API}/schools/{school.id}", headers=super_headers, json={"is_active": False})
    assert res.json()["data"]["is_active"] is False
    # Existing tokens stop working and new logins are refused.
    assert (await client.get(f"{API}/auth/me", headers=admin_headers)).status_code == 401
    assert (await factories.login(client, admin.email, PASSWORD, "alpha")).json()["error"]["code"] == "SCHOOL_INACTIVE"


async def test_school_users_cannot_use_platform_endpoints(client, admin_headers, other_school):
    assert (await client.get(f"{API}/schools", headers=admin_headers)).status_code == 403
    assert (await client.get(f"{API}/schools/{other_school.id}", headers=admin_headers)).status_code == 403
    assert (await client.post(f"{API}/schools", headers=admin_headers, json=NEW_SCHOOL)).status_code == 403


async def test_super_admin_has_no_school_context(client, super_headers):
    res = await client.get(f"{API}/schools/current", headers=super_headers)
    assert res.status_code == 403 and res.json()["error"]["code"] == "SCHOOL_REQUIRED"
