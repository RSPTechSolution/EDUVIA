from tests import factories
from tests.factories import API, PASSWORD

NEW = {"email": "New.Teacher@alpha.edu", "full_name": "New Teacher", "role": "teacher", "password": "Teach1234", "phone": "+91 98000 00001"}


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
    rows = res.json()["data"]
    actions = [r["action"] for r in rows]
    assert "user.create" in actions and "auth.login" in actions
    assert rows[0]["user_name"] == "Admin"


async def test_user_detail_shows_what_each_person_is_connected_to(client, db, school, admin_headers):
    """A parent's children (with attendance and fees), a student's own record, a teacher's classes, and recent activity."""
    from datetime import timedelta
    from decimal import Decimal
    from sqlalchemy import select
    from app.models import FeeInvoice, Student, User
    from app.services.fee_service import academic_year
    from tests import test_communication
    from tests.test_attendance import today

    a, _, _, _, kiran, parent_pw = await test_communication.setup(client, db, school, admin_headers)
    db.add(FeeInvoice(school_id=school.id, invoice_no="INV-UD-1", student_id=kiran, term="Q1", academic_year=academic_year(today()),
                      issue_date=today() - timedelta(days=30), due_date=today() - timedelta(days=5), total=Decimal(5000), paid=Decimal(2000), status="partial"))
    await db.commit()
    t7 = await db.scalar(select(User.id).where(User.email == "t7@t.com"))
    await client.patch(f"{API}/classes/sections/{a.id}", headers=admin_headers, json={"class_teacher_id": str(t7)})
    await factories.login_headers(client, "kdad@t.com", parent_pw, school.slug)  # leaves a sign-in in the audit log

    # A login for Kiran, created from the student's profile.
    made = await client.post(f"{API}/users", headers=admin_headers, json={
        "email": "kiran@t.com", "full_name": "Kiran Kumar", "role": "student", "password": "Study1234", "student_id": kiran})
    assert made.status_code == 201, made.text
    st = (await client.get(f"{API}/students/{kiran}", headers=admin_headers)).json()["data"]
    assert st["login_email"] == "kiran@t.com" and st["user_id"] == made.json()["data"]["id"]

    get = lambda uid: client.get(f"{API}/users/{uid}", headers=admin_headers)  # noqa: E731
    dad = await db.scalar(select(User.id).where(User.email == "kdad@t.com"))
    parent = (await get(dad)).json()["data"]
    child = parent["children"][0]
    assert child["student_id"] == kiran and child["admission_no"] == "C1" and child["fee_due"] == 3000.0 and child["fee_overdue"] is True
    assert any(x["action"] == "auth.login" for x in parent["activity"])

    student = (await get(st["user_id"])).json()["data"]
    assert student["student"]["student_id"] == kiran and student["student"]["fee_due"] == 3000.0 and student["children"] == []

    teacher = (await get(t7)).json()["data"]
    assert [s["label"] for s in teacher["class_teacher_of"]] == ["Class 7 – A"]
    assert any(t.startswith("Mathematics · Class 7 – A") for t in teacher["teaching"])

    # Only those who manage users see these pages; a teacher can't.
    th = await factories.login_headers(client, "t7@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/users/{dad}", headers=th)).status_code == 403
    assert await db.scalar(select(Student.user_id).where(Student.id == kiran))
