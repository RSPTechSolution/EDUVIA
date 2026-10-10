from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from tests import factories
from tests.factories import API, PASSWORD, student_body


def today() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def school_day(back: int = 0) -> date:
    """A recent non-Sunday."""
    d = today() - timedelta(days=back)
    return d - timedelta(days=1) if d.weekday() == 6 else d


async def setup(client, db, school, headers, n=3):
    _, section = await factories.klass(db, school, "Class 4", ("A", "B"))
    ids = []
    for i in range(n):
        body = student_body(section, f"A{i}", first_name=f"Kid{i}", roll_no=i + 1)
        if i == 0:
            body["guardians"] = [{"new_parent": {"full_name": "Mum Zero", "phone": "+91 90000 00001", "email": "mum@t.com"}, "relationship": "mother"}]
        res = await client.post(f"{API}/students", headers=headers, json=body)
        assert res.status_code == 201, res.text
        ids.append(res.json()["data"]["student"]["id"])
        if i == 0:
            parent_pw = res.json()["data"]["new_parent_passwords"]["mum@t.com"]
    teacher = await factories.user(db, school, "ct@t.com", "teacher")
    other = await factories.user(db, school, "other@t.com", "teacher")
    await client.patch(f"{API}/classes/sections/{section.id}", headers=headers, json={"class_teacher_id": str(teacher.id)})
    return section, ids, parent_pw, teacher, other


async def test_class_teacher_marks_and_others_cannot(client, db, school, admin_headers):
    section, ids, _, _, _ = await setup(client, db, school, admin_headers)
    t = await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug)
    day = school_day()

    mine = (await client.get(f"{API}/attendance/sections", headers=t, params={"date": day.isoformat()})).json()["data"]
    assert [s["label"] for s in mine] == ["Class 4 – A"] and mine[0]["is_class_teacher"] and mine[0]["marked"] == 0

    roster = (await client.get(f"{API}/attendance/sections/{section.id}", headers=t, params={"date": day.isoformat()})).json()["data"]
    assert roster["editable"] and [s["status"] for s in roster["students"]] == [None, None, None]

    body = {"date": day.isoformat(), "records": [
        {"student_id": ids[0], "status": "present"}, {"student_id": ids[1], "status": "absent", "remark": "Fever"},
        {"student_id": ids[2], "status": "late"}]}
    saved = await client.put(f"{API}/attendance/sections/{section.id}", headers=t, json=body)
    assert saved.status_code == 200, saved.text
    data = saved.json()["data"]
    assert data["counts"] == {"present": 1, "absent": 1, "late": 1, "half_day": 0, "leave": 0}
    assert data["marked_by"] == "Ct" and data["students"][1]["remark"] == "Fever"

    # Re-marking updates rather than duplicating.
    body["records"][1]["status"] = "present"
    again = (await client.put(f"{API}/attendance/sections/{section.id}", headers=t, json=body)).json()["data"]
    assert again["counts"]["present"] == 2 and again["counts"]["absent"] == 0

    o = await factories.login_headers(client, "other@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/attendance/sections", headers=o)).json()["data"] == []
    denied = await client.put(f"{API}/attendance/sections/{section.id}", headers=o, json=body)
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "NOT_YOUR_SECTION"


async def test_date_rules(client, db, school, admin_headers):
    section, ids, _, _, _ = await setup(client, db, school, admin_headers, n=1)
    t = await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug)
    rec = [{"student_id": ids[0], "status": "present"}]
    future = await client.put(f"{API}/attendance/sections/{section.id}", headers=t,
                              json={"date": (today() + timedelta(days=1)).isoformat(), "records": rec})
    assert future.status_code == 422
    old = school_day(10)
    locked = await client.put(f"{API}/attendance/sections/{section.id}", headers=t, json={"date": old.isoformat(), "records": rec})
    assert locked.json()["error"]["code"] == "ATTENDANCE_LOCKED"
    # The office can correct older days.
    assert (await client.put(f"{API}/attendance/sections/{section.id}", headers=admin_headers,
                             json={"date": old.isoformat(), "records": rec})).status_code == 200
    # Students from another section are rejected.
    _, other_section = await factories.klass(db, school, "Class 9")
    stranger = (await client.post(f"{API}/students", headers=admin_headers, json=student_body(other_section, "Z1"))).json()["data"]["student"]["id"]
    bad = await client.put(f"{API}/attendance/sections/{section.id}", headers=t,
                           json={"date": school_day().isoformat(), "records": [{"student_id": stranger, "status": "present"}]})
    assert bad.status_code == 422


async def test_parent_sees_only_their_child(client, db, school, admin_headers):
    section, ids, parent_pw, _, _ = await setup(client, db, school, admin_headers)
    day = school_day()
    await client.put(f"{API}/attendance/sections/{section.id}", headers=admin_headers, json={"date": day.isoformat(), "records": [
        {"student_id": ids[0], "status": "absent"}, {"student_id": ids[1], "status": "present"}]})
    p = await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)
    month = day.strftime("%Y-%m")
    mine = (await client.get(f"{API}/attendance/my", headers=p, params={"month": month})).json()["data"]
    assert len(mine) == 1 and mine[0]["student_id"] == ids[0]
    assert mine[0]["days"] == [{"date": day.isoformat(), "status": "absent", "remark": None}]
    assert mine[0]["month_percent"] == 0.0
    assert (await client.get(f"{API}/attendance/students/{ids[1]}", headers=p)).status_code == 404
    assert (await client.get(f"{API}/attendance/students/{ids[0]}", headers=p, params={"month": month})).status_code == 200
    assert (await client.get(f"{API}/attendance/sections", headers=p)).status_code == 403


async def test_report_and_overview(client, db, school, admin_headers):
    section, ids, _, _, _ = await setup(client, db, school, admin_headers)
    d1, d2 = school_day(1), school_day()
    if d1 == d2:
        d1 = d2 - timedelta(days=2)
    for d, statuses in ((d1, ["present", "absent", "half_day"]), (d2, ["present", "absent", "leave"])):
        await client.put(f"{API}/attendance/sections/{section.id}", headers=admin_headers, json={
            "date": d.isoformat(), "records": [{"student_id": i, "status": s} for i, s in zip(ids, statuses)]})
    month = d2.strftime("%Y-%m")
    if d1.month == d2.month:
        rep = (await client.get(f"{API}/attendance/sections/{section.id}/report", headers=admin_headers, params={"month": month})).json()["data"]
        pct = {r["name"]: r["percent"] for r in rep["rows"]}
        assert rep["school_days"] == 2
        assert pct == {"Kid0 Sharma": 100.0, "Kid1 Sharma": 0.0, "Kid2 Sharma": 50.0}  # leave days don't count against
    ov = (await client.get(f"{API}/attendance/overview", headers=admin_headers, params={"date": d2.isoformat()})).json()["data"]
    assert ov["sections_total"] == 2 and ov["sections_marked"] == 1 and ov["counts"]["absent"] == 1
