from tests import factories
from tests.factories import API, PASSWORD

NEW = {"email": "New.Teacher@alpha.edu", "full_name": "New Teacher", "role": "teacher", "password": "Teach1234"}


async def test_user_crud(client, admin_headers):
    created = await client.post(f"{API}/users", headers=admin_headers, json=NEW)
    assert created.status_code == 201, created.text
    user = created.json()["data"]
    assert user["email"] == "new.teacher@alpha.edu" and user["must_change_password"] is True

    listed = await client.get(f"{API}/users?search=new&role=teacher", headers=admin_headers)
    assert listed.json()["meta"]["total"] == 1

    updated = await client.patch(f"{API}/users/{user['id']}", headers=admin_headers, json={"full_name": "Renamed"})
    assert updated.json()["data"]["full_name"] == "Renamed"

    assert (await client.delete(f"{API}/users/{user['id']}", headers=admin_headers)).status_code == 200
    assert (await client.get(f"{API}/users/{user['id']}", headers=admin_headers)).status_code == 404


async def test_duplicate_email_conflict(client, admin_headers):
    await client.post(f"{API}/users", headers=admin_headers, json=NEW)
    dup = await client.post(f"{API}/users", headers=admin_headers, json={**NEW, "email": "new.teacher@ALPHA.edu"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "EMAIL_TAKEN"


async def test_invalid_role_rejected(client, admin_headers):
    res = await client.post(f"{API}/users", headers=admin_headers, json={**NEW, "role": "super_admin"})
    assert res.status_code == 422


async def test_teacher_cannot_manage_users(client, db, school):
    await factories.user(db, school, "t@alpha.edu", "teacher")
    headers = await factories.login_headers(client, "t@alpha.edu", PASSWORD, "alpha")
    res = await client.post(f"{API}/users", headers=headers, json=NEW)
    assert res.status_code == 403 and res.json()["error"]["code"] == "PERMISSION_DENIED"
    assert (await client.get(f"{API}/users", headers=headers)).status_code == 403


async def test_admin_cannot_lock_themselves_out(client, admin, admin_headers):
    res = await client.patch(f"{API}/users/{admin.id}", headers=admin_headers, json={"is_active": False})
    assert res.json()["error"]["code"] == "SELF_MODIFICATION"
    assert (await client.delete(f"{API}/users/{admin.id}", headers=admin_headers)).json()["error"]["code"] == "SELF_MODIFICATION"


async def test_deactivating_a_user_ends_their_sessions(client, db, school, admin_headers):
    other = await factories.user(db, school, "admin2@alpha.edu", "school_admin")
    h2 = await factories.login_headers(client, "admin2@alpha.edu", PASSWORD, "alpha")
    assert (await client.get(f"{API}/auth/me", headers=h2)).status_code == 200
    res = await client.patch(f"{API}/users/{other.id}", headers=admin_headers, json={"is_active": False})
    assert res.status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=h2)).status_code == 401


async def test_admin_set_password_forces_change(client, db, school, admin_headers):
    t = await factories.user(db, school, "t@alpha.edu", "teacher")
    res = await client.post(f"{API}/users/{t.id}/set-password", headers=admin_headers, json={"password": "Temp12345"})
    assert res.status_code == 200
    login = await factories.login(client, "t@alpha.edu", "Temp12345", "alpha")
    assert login.json()["data"]["user"]["must_change_password"] is True


async def test_audit_log_records_actions(client, admin_headers):
    await client.post(f"{API}/users", headers=admin_headers, json=NEW)
    res = await client.get(f"{API}/users/audit-log", headers=admin_headers)
    actions = [r["action"] for r in res.json()["data"]]
    assert "user.create" in actions and "auth.login" in actions
