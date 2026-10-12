"""Profiles show everything about a person across the modules: a book a student borrows shows on the student's
profile, a hostel bed and their requests too; a staff member's loans, leave and classes show on theirs; a parent's
page shows their children's requests."""
from datetime import timedelta

from sqlalchemy import select

from app.models import User
from tests import factories, test_attendance
from tests.factories import API, PASSWORD
from tests.test_attendance import today
from tests.test_campus import _enable, _max_plan


async def test_a_borrowed_book_shows_on_the_borrowers_profiles(client, db, school, admin_headers):
    await _enable(client, admin_headers, "library")
    _, ids, parent_pw, _, _ = await test_attendance.setup(client, db, school, admin_headers)
    await factories.user(db, school, "lib@t.com", "librarian")
    lib = await factories.login_headers(client, "lib@t.com", PASSWORD, school.slug)
    await client.post(f"{API}/library/books", headers=lib, json={"title": "Wings of Fire", "author": "A. P. J. Abdul Kalam", "copies": 2})
    assert (await client.post(f"{API}/library/issue", headers=lib, json={"accession_no": "00001", "borrower": "A0"})).status_code == 201
    assert (await client.post(f"{API}/library/issue", headers=lib, json={"accession_no": "00002", "borrower": "ct@t.com"})).status_code == 201

    # On the student's profile (for staff), with the due date.
    o = (await client.get(f"{API}/students/{ids[0]}/overview", headers=admin_headers)).json()["data"]
    assert [b["title"] for b in o["library"]["current"]] == ["Wings of Fire"] and o["library"]["current"][0]["overdue"] is False
    teacher = await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/students/{ids[0]}/overview", headers=teacher)).status_code == 200
    parent = await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)
    assert (await client.get(f"{API}/students/{ids[0]}/overview", headers=parent)).status_code == 403

    # On the staff member's page and on their own profile.
    ct = await db.scalar(select(User.id).where(User.email == "ct@t.com"))
    page = (await client.get(f"{API}/users/{ct}", headers=admin_headers)).json()["data"]
    assert [b["title"] for b in page["library"]["current"]] == ["Wings of Fire"]
    mine = (await client.get(f"{API}/users/me/overview", headers=teacher)).json()["data"]
    assert mine["library"]["current"][0]["accession_no"] == "00002"

    # Returned books move to the history.
    await client.post(f"{API}/library/return", headers=lib, json={"accession_no": "00001"})
    o = (await client.get(f"{API}/students/{ids[0]}/overview", headers=admin_headers)).json()["data"]
    assert o["library"]["current"] == [] and o["library"]["returned_total"] == 1


async def test_hostel_requests_and_family_on_profiles(client, db, school, admin_headers):
    await _max_plan(db, school)
    await _enable(client, admin_headers, "hostel")
    _, ids, parent_pw, teacher, _ = await test_attendance.setup(client, db, school, admin_headers)
    h = (await client.post(f"{API}/hostels", headers=admin_headers, json={"name": "Sarojini House", "kind": "girls", "warden_id": str(teacher.id)})).json()["data"]
    h = (await client.post(f"{API}/hostels/{h['id']}/rooms", headers=admin_headers, json={"number": "101", "floor": "First", "capacity": 2})).json()["data"]
    await client.post(f"{API}/hostels/allocations", headers=admin_headers, json={"student_id": ids[0], "room_id": h["room_list"][0]["id"]})

    parent = await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)
    start = (today() + timedelta(days=4)).isoformat()
    assert (await client.post(f"{API}/leave", headers=parent, json={"student_id": ids[0], "from_date": start, "to_date": start,
                                                                    "kind": "family", "reason": "Wedding in the family"})).status_code == 201

    mum = await db.scalar(select(User.id).where(User.email == "mum@t.com"))
    assert (await client.post(f"{API}/students/{ids[1]}/guardians", headers=admin_headers, json={"user_id": str(mum), "relationship": "mother"})).status_code in (200, 201)

    o = (await client.get(f"{API}/students/{ids[0]}/overview", headers=admin_headers)).json()["data"]
    assert o["hostel"]["hostel"] == "Sarojini House" and o["hostel"]["room"] == "101"
    assert [(r["kind"], r["status"]) for r in o["requests"]] == [("leave", "pending")]
    assert [s["name"] for s in o["siblings"]] == ["Kid1 Sharma"]  # same parent

    page = (await client.get(f"{API}/users/{mum}", headers=admin_headers)).json()["data"]
    assert [(r["student_name"], r["kind"]) for r in page["requests"]] == [("Kid0 Sharma", "leave")]
    assert (await client.get(f"{API}/users/me/overview", headers=parent)).json()["data"]["requests"][0]["kind"] == "leave"

    warden = (await client.get(f"{API}/users/{teacher.id}", headers=admin_headers)).json()["data"]
    assert warden["warden_of"] == ["Sarojini House"]


async def test_each_role_sees_its_own_profile(client, db, school, admin_headers):
    _, ids, parent_pw, teacher, _ = await test_attendance.setup(client, db, school, admin_headers)
    await factories.user(db, school, "guard@t.com", "security_guard")
    for email, pw in (("ct@t.com", PASSWORD), ("mum@t.com", parent_pw), ("guard@t.com", PASSWORD)):
        h = await factories.login_headers(client, email, pw, school.slug)
        res = await client.get(f"{API}/users/me/overview", headers=h)
        assert res.status_code == 200, (email, res.text)
        assert res.json()["data"]["email"] == email
    me = (await client.get(f"{API}/users/me/overview", headers=await factories.login_headers(client, "mum@t.com", parent_pw, school.slug))).json()["data"]
    assert {c["name"] for c in me["children"]} >= {"Kid0 Sharma"}
