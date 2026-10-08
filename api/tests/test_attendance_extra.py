"""Calendar, leave requests, QR scans, biometric (ADMS) devices and period-wise attendance."""
from datetime import timedelta

from sqlalchemy import select

from app.models import AttendanceRecord, School
from tests import factories, test_attendance
from tests.factories import API, PASSWORD, student_body
from tests.test_attendance import school_day, today


def next_school_day(after: int = 1):
    d = today() + timedelta(days=after)
    return d + timedelta(days=1) if d.weekday() == 6 else d


async def test_calendar_holidays_close_attendance(client, db, school, admin_headers):
    section, ids, parent_pw, _, _ = await test_attendance.setup(client, db, school, admin_headers)
    t = await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug)
    p = await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)
    day = school_day()
    assert (await client.post(f"{API}/calendar", headers=t, json={"title": "x", "kind": "holiday", "start_date": day.isoformat()})).status_code == 403
    bad = await client.post(f"{API}/calendar", headers=admin_headers, json={"title": "x", "kind": "holiday", "start_date": day.isoformat(),
                                                                            "end_date": (day - timedelta(days=1)).isoformat()})
    assert bad.status_code == 422
    hol = (await client.post(f"{API}/calendar", headers=admin_headers, json={"title": "Founders' Day", "kind": "holiday",
                                                                             "start_date": day.isoformat()})).json()["data"]
    assert hol["closed"] and hol["end_date"] == day.isoformat()
    await client.post(f"{API}/calendar", headers=admin_headers, json={"title": "Science fair", "kind": "event", "start_date": day.isoformat()})

    roster = (await client.get(f"{API}/attendance/sections/{section.id}", headers=t, params={"date": day.isoformat()})).json()["data"]
    assert not roster["editable"] and "Founders' Day" in roster["locked_reason"]
    seen = (await client.get(f"{API}/calendar", headers=p, params={"from": (day - timedelta(days=3)).isoformat(),
                                                                   "to": (day + timedelta(days=3)).isoformat()})).json()["data"]
    assert {e["title"] for e in seen} == {"Founders' Day", "Science fair"}
    assert any(n["kind"] == "calendar" for n in (await client.get(f"{API}/notifications", headers=p)).json()["data"])

    await client.delete(f"{API}/calendar/{hol['id']}", headers=admin_headers)
    roster = (await client.get(f"{API}/attendance/sections/{section.id}", headers=t, params={"date": day.isoformat()})).json()["data"]
    assert roster["editable"]


async def test_leave_request_flow(client, db, school, admin_headers):
    section, ids, parent_pw, teacher, other = await test_attendance.setup(client, db, school, admin_headers)
    t = await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug)
    o = await factories.login_headers(client, "other@t.com", PASSWORD, school.slug)
    p = await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)
    start = next_school_day(1)
    end = start + timedelta(days=2)
    body = {"student_id": ids[0], "from_date": start.isoformat(), "to_date": end.isoformat(), "kind": "family", "reason": "Cousin's wedding in Jaipur"}

    assert (await client.post(f"{API}/leave", headers=p, json={**body, "student_id": ids[1]})).status_code == 404  # not their child
    assert (await client.post(f"{API}/leave", headers=p, json={**body, "to_date": (start - timedelta(days=1)).isoformat()})).status_code == 422
    req = (await client.post(f"{API}/leave", headers=p, json=body)).json()["data"]
    assert req["status"] == "pending" and req["can_cancel"] and not req["can_decide"]
    assert (await client.post(f"{API}/leave", headers=p, json=body)).status_code == 422  # overlaps

    # The class teacher hears about it and decides; another teacher can't see or decide it.
    assert any(n["kind"] == "leave" for n in (await client.get(f"{API}/notifications", headers=t)).json()["data"])
    mine = (await client.get(f"{API}/leave", headers=t)).json()["data"]
    assert [r["id"] for r in mine] == [req["id"]] and mine[0]["can_decide"]
    assert (await client.get(f"{API}/leave", headers=o)).json()["data"] == []
    assert (await client.post(f"{API}/leave/{req['id']}/decide", headers=o, json={"approve": True})).status_code == 403
    assert (await client.post(f"{API}/leave/{req['id']}/decide", headers=p, json={"approve": True})).status_code == 403

    done = (await client.post(f"{API}/leave/{req['id']}/decide", headers=t, json={"approve": True, "note": "Enjoy!"})).json()["data"]
    assert done["status"] == "approved" and done["decided_by"] == "Ct"
    assert (await client.post(f"{API}/leave/{req['id']}/decide", headers=t, json={"approve": False})).json()["error"]["code"] == "LEAVE_DECIDED"
    recs = (await db.scalars(select(AttendanceRecord).where(AttendanceRecord.method == "leave"))).all()
    assert len(recs) == done["days"] and all(r.status == "leave" for r in recs)
    bell = (await client.get(f"{API}/notifications", headers=p)).json()["data"]
    assert bell[0]["title"].startswith("Leave approved")

    # Families may cancel approved leave before it starts; the leave days are removed again.
    cancelled = (await client.post(f"{API}/leave/{req['id']}/cancel", headers=p)).json()["data"]
    assert cancelled["status"] == "cancelled"
    assert (await db.scalars(select(AttendanceRecord).where(AttendanceRecord.method == "leave").execution_options(populate_existing=True))).all() == []

    # A rejected request marks nothing.
    req2 = (await client.post(f"{API}/leave", headers=p, json={**body, "kind": "sick", "reason": "Fever"})).json()["data"]
    rej = (await client.post(f"{API}/leave/{req2['id']}/decide", headers=admin_headers, json={"approve": False, "note": "Bring a note"})).json()["data"]
    assert rej["status"] == "rejected" and rej["decision_note"] == "Bring a note"
    assert other and teacher


async def test_qr_scan_marks_present_then_late(client, db, school, admin_headers):
    section, ids, *_ = await test_attendance.setup(client, db, school, admin_headers)
    guard = await factories.user(db, school, "guard@t.com", "security_guard")
    g = await factories.login_headers(client, "guard@t.com", PASSWORD, school.slug)
    acc = await factories.user(db, school, "acc2@t.com", "accountant")
    a = await factories.login_headers(client, "acc2@t.com", PASSWORD, school.slug)
    if today().weekday() == 6:
        return  # the school is closed on Sundays; scanning is refused, covered elsewhere
    first = (await client.post(f"{API}/attendance/scan", headers=g, json={"code": "A0"})).json()["data"]
    assert first["name"] == "Kid0 Sharma" and first["status"] == "present" and not first["already"]
    again = (await client.post(f"{API}/attendance/scan", headers=g, json={"code": "eduvia:a0"})).json()["data"]
    assert again["already"]
    assert (await client.post(f"{API}/attendance/scan", headers=g, json={"code": "NOPE"})).status_code == 404
    assert (await client.post(f"{API}/attendance/scan", headers=a, json={"code": "A1"})).status_code == 403

    # After the school's cut-off, a scan is late.
    s = await db.get(School, school.id)
    s.settings = {"late_after": "00:00"}
    await db.commit()
    late = (await client.post(f"{API}/attendance/scan", headers=g, json={"code": "A1"})).json()["data"]
    assert late["status"] == "late"
    rec = await db.scalar(select(AttendanceRecord).where(AttendanceRecord.method == "qr", AttendanceRecord.status == "late"))
    assert rec is not None
    assert guard and acc


async def test_biometric_device_adms_flow(client, db, school, other_school, admin_headers):
    section, ids, *_ = await test_attendance.setup(client, db, school, admin_headers)
    hr = await factories.user(db, school, "hr2@t.com", "hr_manager")
    t_user = await factories.user(db, school, "bio@t.com", "teacher")
    th = await factories.login_headers(client, "bio@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/devices", headers=th)).status_code == 403

    dev = await client.post(f"{API}/devices", headers=admin_headers, json={"serial_no": "CQZ7231460123", "name": "Main gate"})
    assert dev.status_code == 201, dev.text
    o_admin = await factories.user(db, other_school, "oa@t.com", "school_admin")
    oh = await factories.login_headers(client, "oa@t.com", PASSWORD, other_school.slug)
    assert (await client.post(f"{API}/devices", headers=oh, json={"serial_no": "cqz7231460123", "name": "Copy"})).status_code == 422

    ids_body = {"students": {ids[0]: "101", ids[1]: "102"}, "users": {str(t_user.id): "9001"}}
    assert (await client.put(f"{API}/devices/ids", headers=admin_headers, json=ids_body)).json()["data"]["updated"] == 3
    dup = await client.put(f"{API}/devices/ids", headers=admin_headers, json={"students": {ids[2]: "101"}})
    assert dup.status_code == 422

    # The machine: handshake, then upload punches (tab separated, device local time).
    unknown = await client.get("/iclock/cdata", params={"SN": "NOT-REGISTERED", "options": "all"})
    assert unknown.status_code == 403
    hs = await client.get("/iclock/cdata", params={"SN": "CQZ7231460123", "options": "all"})
    assert hs.status_code == 200 and hs.text.startswith("GET OPTION FROM: CQZ7231460123") and "TimeZone=5.5" in hs.text
    day = school_day()
    lines = "\n".join([f"101\t{day} 07:52:10\t0\t1\t0\t0", f"9001\t{day} 07:40:00\t0\t1\t0\t0", f"555\t{day} 07:41:00\t0\t1\t0\t0",
                       f"101\t{day} 13:30:00\t1\t1\t0\t0", "garbage line"])
    up = await client.post("/iclock/cdata", params={"SN": "CQZ7231460123", "table": "ATTLOG", "Stamp": "1"}, content=lines)
    assert up.status_code == 200 and up.text == "OK: 4"
    again = await client.post("/iclock/cdata", params={"SN": "CQZ7231460123", "table": "ATTLOG"}, content=lines)
    assert again.text == "OK: 0"  # resent punches are ignored
    assert (await client.post("/iclock/cdata", params={"SN": "CQZ7231460123", "table": "OPERLOG"}, content="x")).text == "OK"
    assert (await client.get("/iclock/getrequest", params={"SN": "CQZ7231460123"})).text == "OK"

    rec = await db.scalar(select(AttendanceRecord).where(AttendanceRecord.method == "biometric"))
    assert rec is not None and str(rec.student_id) == ids[0] and rec.status == "present" and rec.date == day
    devs = (await client.get(f"{API}/devices", headers=admin_headers)).json()["data"]
    assert devs[0]["online"] and devs[0]["punches"] == 4
    punches = (await client.get(f"{API}/devices/punches", headers=admin_headers)).json()["data"]
    assert {p["pin"]: p["matched"] for p in punches} == {"101": "Kid0 Sharma", "9001": "Bio", "555": None}

    # A disabled device is refused.
    await client.put(f"{API}/devices/{devs[0]['id']}", headers=admin_headers, json={"serial_no": "CQZ7231460123", "name": "Main gate", "is_enabled": False})
    assert (await client.get("/iclock/getrequest", params={"SN": "CQZ7231460123"})).status_code == 403
    assert hr and o_admin


async def test_period_attendance_and_bunks(client, db, school, admin_headers):
    periods = (await client.put(f"{API}/timetable/periods", headers=admin_headers, json={"periods": [
        {"name": "P1", "start_time": "08:00", "end_time": "08:40"}, {"name": "P2", "start_time": "08:40", "end_time": "09:20"}]})).json()["data"]
    maths = (await client.post(f"{API}/timetable/subjects", headers=admin_headers, json={"name": "Mathematics"})).json()["data"]
    _, section = await factories.klass(db, school, "Class 10")
    t = await factories.user(db, school, "pt1@t.com", "teacher")
    o = await factories.user(db, school, "pt2@t.com", "teacher")
    day = school_day()
    for period, teacher in ((periods[0], t), (periods[1], o)):
        await client.put(f"{API}/timetable/slots", headers=admin_headers, json={
            "section_id": str(section.id), "day": day.isoweekday(), "period_id": period["id"], "subject_id": maths["id"], "teacher_id": str(teacher.id)})
    ids = [(await client.post(f"{API}/students", headers=admin_headers, json=student_body(section, f"B{i}", first_name=n))).json()["data"]["student"]["id"]
           for i, n in enumerate(["Avi", "Bea", "Cy"])]
    th = await factories.login_headers(client, "pt1@t.com", PASSWORD, school.slug)
    oh = await factories.login_headers(client, "pt2@t.com", PASSWORD, school.slug)
    # Morning roll call by the admin: Cy absent.
    await client.put(f"{API}/attendance/sections/{section.id}", headers=admin_headers, json={"date": day.isoformat(), "records": [
        {"student_id": ids[0], "status": "present"}, {"student_id": ids[1], "status": "present"}, {"student_id": ids[2], "status": "absent"}]})

    cards = (await client.get(f"{API}/attendance/periods", headers=th, params={"date": day.isoformat()})).json()["data"]
    assert [(c["period_name"], c["marked"]) for c in cards] == [("P1", False)]
    entry = cards[0]["entry_id"]
    roster = (await client.get(f"{API}/attendance/periods/{entry}", headers=th, params={"date": day.isoformat()})).json()["data"]
    assert [(s["name"], s["absent"]) for s in roster["students"]] == [("Avi Sharma", False), ("Bea Sharma", False), ("Cy Sharma", True)]
    assert (await client.get(f"{API}/attendance/periods/{entry}", headers=oh, params={"date": day.isoformat()})).status_code == 403

    saved = (await client.put(f"{API}/attendance/periods/{entry}", headers=th, json={"date": day.isoformat(), "absent_ids": [ids[1], ids[2]]})).json()["data"]
    assert saved["marked"] and [s["absent"] for s in saved["students"]] == [False, True, True]
    assert (await client.put(f"{API}/attendance/periods/{entry}", headers=th, json={"date": (day + timedelta(days=7)).isoformat(), "absent_ids": []})).status_code == 422

    bunked = (await client.get(f"{API}/attendance/bunks", headers=admin_headers, params={"date": day.isoformat()})).json()["data"]
    assert [(b["name"], b["periods"]) for b in bunked] == [("Bea Sharma", ["P1"])]  # Cy was absent all day, so not a bunk
