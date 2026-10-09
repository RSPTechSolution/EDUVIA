"""Gate and security: visitors, gate passes, workers, compliance vault, CCTV consent."""
import asyncio
from datetime import UTC, datetime, timedelta

from app.models import CctvConsent
from app.services import notification_service
from tests import factories, test_attendance
from tests.factories import API, PASSWORD
from tests.test_attendance import today
from tests.test_campus import _enable, _max_plan


async def _notes(client, headers):
    await asyncio.gather(*notification_service._running)
    return (await client.get(f"{API}/notifications", headers=headers)).json()["data"]


async def _setup(client, db, school, admin_headers, *modules):
    await _max_plan(db, school)
    await _enable(client, admin_headers, *modules)
    section, ids, parent_pw, teacher, other = await test_attendance.setup(client, db, school, admin_headers)
    await factories.user(db, school, "guard@t.com", "security_guard")
    await factories.user(db, school, "front@t.com", "receptionist")
    return {
        "section": section, "ids": ids, "teacher": teacher,
        "guard": await factories.login_headers(client, "guard@t.com", PASSWORD, school.slug),
        "front": await factories.login_headers(client, "front@t.com", PASSWORD, school.slug),
        "ct": await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug),
        "other": await factories.login_headers(client, "other@t.com", PASSWORD, school.slug),
        "parent": await factories.login_headers(client, "mum@t.com", parent_pw, school.slug),
    }


async def test_security_needs_its_module(client, admin_headers):
    assert (await client.get(f"{API}/gate/visitors", headers=admin_headers)).status_code == 403
    assert (await client.get(f"{API}/cctv/cameras", headers=admin_headers)).status_code == 403


async def test_visitor_log(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers, "security")
    guard, ct = s["guard"], s["ct"]
    assert (await client.post(f"{API}/gate/visitors", headers=ct, json={"name": "X Y", "purpose": "Meeting"})).status_code == 403
    assert (await client.get(f"{API}/gate/visitors", headers=s["parent"])).status_code == 403

    v = (await client.post(f"{API}/gate/visitors", headers=guard, json={"name": "Ramesh Kumar", "phone": "+91 98765 43210", "purpose": "Book delivery",
                                                                        "host_id": str(s["teacher"].id), "vehicle_no": "pb10 ab 1", "badge_no": "V-12"})).json()["data"]
    assert v["status"] == "in" and v["vehicle_no"] == "PB10 AB 1" and v["meeting"] == "Ct" and v["logged_by"] == "Guard"
    assert any(n["title"] == "Ramesh Kumar is at the gate" for n in await _notes(client, ct))
    look = (await client.get(f"{API}/gate/visitors/lookup", headers=guard, params={"phone": "9876543210"})).json()["data"]
    assert look["name"] == "Ramesh Kumar" and look["visits"] == 1
    assert (await client.get(f"{API}/gate/visitors/lookup", headers=guard, params={"phone": "1111111111"})).json()["data"] is None
    out = (await client.post(f"{API}/gate/visitors/{v['id']}/out", headers=guard)).json()["data"]
    assert out["status"] == "out" and out["out_at"]
    assert (await client.post(f"{API}/gate/visitors/{v['id']}/out", headers=guard)).json()["error"]["code"] == "NOT_INSIDE"

    # A teacher expects a guest; the gate checks them in; the teacher sees only their own guests.
    past = await client.post(f"{API}/gate/visitors/invite", headers=ct, json={"name": "Old Date", "purpose": "Talk", "expected_on": (today() - timedelta(days=1)).isoformat()})
    assert past.status_code == 422
    inv = (await client.post(f"{API}/gate/visitors/invite", headers=ct, json={"name": "Dr Mehta", "purpose": "Health talk for Class 4",
                                                                              "expected_on": today().isoformat(), "people": 2})).json()["data"]
    assert inv["status"] == "expected" and inv["can_cancel"]
    assert [x["name"] for x in (await client.get(f"{API}/gate/visitors", headers=s["other"], params={"date": today().isoformat()})).json()["data"]] == []
    day = (await client.get(f"{API}/gate/visitors", headers=guard, params={"date": today().isoformat()})).json()["data"]
    assert {x["name"]: x["status"] for x in day} == {"Ramesh Kumar": "out", "Dr Mehta": "expected"}
    assert (await client.get(f"{API}/gate/summary", headers=guard)).json()["data"]["expected_today"] == 1
    arrived = (await client.post(f"{API}/gate/visitors/{inv['id']}/arrive", headers=guard, json={"id_proof": "Aadhaar ••••4321"})).json()["data"]
    assert arrived["status"] == "in" and arrived["id_proof"] == "Aadhaar ••••4321"
    summary = (await client.get(f"{API}/gate/summary", headers=guard)).json()["data"]
    assert summary["visitors_inside"] == 1 and summary["visitors_today"] == 2 and summary["expected_today"] == 0
    assert (await client.post(f"{API}/gate/visitors/{inv['id']}/cancel", headers=ct)).status_code == 403  # already here


async def test_gate_pass_flow(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers, "security", "communication")
    guard, ct, parent = s["guard"], s["ct"], s["parent"]
    soon = datetime.now(UTC).isoformat()  # now, not later: a pass for after midnight would belong to tomorrow
    body = {"student_id": s["ids"][0], "reason": "Dentist appointment", "pickup_name": "Mum Zero", "pickup_relation": "Mother", "leave_at": soon}
    assert (await client.post(f"{API}/gate/passes", headers=parent, json={**body, "student_id": s["ids"][1]})).status_code == 404  # not their child
    assert (await client.post(f"{API}/gate/passes", headers=parent, json={**body, "leave_at": (datetime.now(UTC) - timedelta(hours=3)).isoformat()})).status_code == 422
    p = (await client.post(f"{API}/gate/passes", headers=parent, json=body)).json()["data"]
    assert p["status"] == "pending" and p["code"] is None
    assert any(n["title"] == "Early pickup: Kid0 Sharma" for n in await _notes(client, ct))

    # Another teacher can't decide; the class teacher can, and doesn't see the code.
    assert (await client.post(f"{API}/gate/passes/{p['id']}/decide", headers=s["other"], json={"approve": True})).status_code == 403
    assert [x["id"] for x in (await client.get(f"{API}/gate/passes", headers=s["other"])).json()["data"]] == []
    d = (await client.post(f"{API}/gate/passes/{p['id']}/decide", headers=ct, json={"approve": True})).json()["data"]
    assert d["status"] == "approved" and d["decided_by"] == "Ct" and d["code"] is None
    mine = (await client.get(f"{API}/gate/passes", headers=parent)).json()["data"][0]
    code = mine["code"]
    assert len(code) == 6 and mine["can_cancel"]
    assert any(code in n["body"] for n in await _notes(client, parent))

    # At the gate: a wrong code finds nothing; the right one shows the child, and marking them out tells the family.
    wrong = "000000" if code != "000000" else "111111"
    assert (await client.get(f"{API}/gate/passes/verify", headers=guard, params={"code": wrong})).json()["error"]["code"] == "INVALID_CODE"
    assert (await client.get(f"{API}/gate/passes/verify", headers=ct, params={"code": code})).status_code == 403
    found = (await client.get(f"{API}/gate/passes/verify", headers=guard, params={"code": code})).json()["data"]
    assert found["student_name"] == "Kid0 Sharma" and found["pickup_name"] == "Mum Zero" and found["class_section"] == "Class 4 – A"
    used = (await client.post(f"{API}/gate/passes/{p['id']}/left", headers=guard)).json()["data"]
    assert used["status"] == "used" and used["verified_by"] == "Guard"
    assert (await client.post(f"{API}/gate/passes/{p['id']}/left", headers=guard)).json()["error"]["code"] == "NOT_APPROVED"
    assert any(n["title"] == "Kid0 has left school" for n in await _notes(client, parent))
    assert (await client.post(f"{API}/gate/passes/{p['id']}/cancel", headers=parent)).status_code == 403

    # The front office issues a pass on the spot: approved straight away.
    office = (await client.post(f"{API}/gate/passes", headers=s["front"], json={**body, "student_id": s["ids"][2], "pickup_name": "Uncle Raj",
                                                                                 "pickup_relation": "Uncle"})).json()["data"]
    assert office["status"] == "approved" and office["code"]
    declined = (await client.post(f"{API}/gate/passes", headers=parent, json=body)).json()["data"]
    assert (await client.post(f"{API}/gate/passes/{declined['id']}/decide", headers=admin_headers, json={"approve": False, "note": "Call the office"})).json()["data"]["status"] == "rejected"
    assert (await client.get(f"{API}/gate/summary", headers=guard)).json()["data"]["passes_today"] == 2


async def test_workers_register(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers, "security")
    guard = s["guard"]
    body = {"name": "Shyam Lal", "phone": "+91 99887 76655", "trade": "Electrician", "agency": "Bright Electricals"}
    assert (await client.post(f"{API}/gate/workers", headers=guard, json=body)).status_code == 403
    w = (await client.post(f"{API}/gate/workers", headers=admin_headers, json=body)).json()["data"]
    assert not w["can_enter"] and w["blocked_reason"] == "Police verification pending"
    assert (await client.post(f"{API}/gate/workers/{w['id']}/in", headers=guard)).json()["error"]["code"] == "ENTRY_BLOCKED"
    assert (await client.put(f"{API}/gate/workers/{w['id']}", headers=admin_headers, json={**body, "police_verified": True})).status_code == 422
    ok_body = {**body, "police_verified": True, "verified_on": "2026-01-10", "valid_until": (today() + timedelta(days=90)).isoformat()}
    assert (await client.put(f"{API}/gate/workers/{w['id']}", headers=admin_headers, json=ok_body)).json()["data"]["can_enter"]
    inside = (await client.post(f"{API}/gate/workers/{w['id']}/in", headers=guard)).json()["data"]
    assert inside["on_campus_since"]
    assert (await client.post(f"{API}/gate/workers/{w['id']}/in", headers=guard)).json()["error"]["code"] == "ALREADY_INSIDE"
    assert (await client.get(f"{API}/gate/summary", headers=guard)).json()["data"]["workers_inside"] == 1
    assert (await client.post(f"{API}/gate/workers/{w['id']}/out", headers=guard)).json()["data"]["on_campus_since"] is None
    logs = (await client.get(f"{API}/gate/worker-logs", headers=guard, params={"date": today().isoformat()})).json()["data"]
    assert [(x["name"], bool(x["out_at"])) for x in logs] == [("Shyam Lal", True)]
    # An ended contract blocks entry.
    await client.put(f"{API}/gate/workers/{w['id']}", headers=admin_headers, json={**ok_body, "valid_until": (today() - timedelta(days=1)).isoformat()})
    assert (await client.post(f"{API}/gate/workers/{w['id']}/in", headers=guard)).json()["error"]["code"] == "ENTRY_BLOCKED"


async def test_compliance_vault(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers, "security")
    await factories.user(db, school, "pr@t.com", "principal")
    pr = await factories.login_headers(client, "pr@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/compliance", headers=s["ct"])).status_code == 403
    assert (await client.get(f"{API}/compliance", headers=s["guard"])).status_code == 403
    fire = (await client.post(f"{API}/compliance", headers=admin_headers, json={"title": "Fire NOC", "category": "Fire safety", "authority": "Fire department",
                                                                                "issued_on": "2025-10-01", "expires_on": (today() + timedelta(days=10)).isoformat()})).json()["data"]
    assert fire["state"] == "expiring" and fire["days_left"] == 10
    water = (await client.post(f"{API}/compliance", headers=pr, json={"title": "Water test report", "category": "Health",
                                                                      "expires_on": (today() - timedelta(days=3)).isoformat()})).json()["data"]
    assert water["state"] == "expired"
    aff = (await client.post(f"{API}/compliance", headers=admin_headers, json={"title": "CBSE affiliation", "category": "Affiliation"})).json()["data"]
    assert aff["state"] == "no_expiry"
    bad = await client.post(f"{API}/compliance", headers=admin_headers, json={"title": "X doc", "category": "Other", "issued_on": "2026-05-01", "expires_on": "2026-01-01"})
    assert bad.status_code == 422
    assert [d["title"] for d in (await client.get(f"{API}/compliance", headers=pr)).json()["data"]] == ["Water test report", "Fire NOC", "CBSE affiliation"]

    up = await client.post(f"{API}/files", headers=admin_headers, data={"purpose": "compliance_doc", "owner_id": fire["id"]},
                           files={"file": ("noc.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert up.status_code == 201, up.text
    assert (await client.post(f"{API}/files", headers=s["guard"], data={"purpose": "compliance_doc", "owner_id": fire["id"]},
                              files={"file": ("x.pdf", b"%PDF-1.4", "application/pdf")})).status_code == 403
    assert next(d for d in (await client.get(f"{API}/compliance", headers=pr)).json()["data"] if d["id"] == fire["id"])["files"] == 1

    assert "Sent 2" in (await client.post(f"{API}/compliance/remind", headers=admin_headers)).json()["data"]["message"]
    assert (await client.post(f"{API}/compliance/remind", headers=admin_headers)).json()["data"]["message"] == "Nothing new is due"
    assert any(n["title"] == "Fire NOC expires soon" for n in await _notes(client, pr))
    renewed = (await client.put(f"{API}/compliance/{fire['id']}", headers=admin_headers, json={"title": "Fire NOC", "category": "Fire safety",
                                                                                              "expires_on": (today() + timedelta(days=365)).isoformat()})).json()["data"]
    assert renewed["state"] == "valid"
    assert (await client.delete(f"{API}/compliance/{water['id']}", headers=pr)).status_code == 200
    assert (await client.get(f"{API}/gate/summary", headers=admin_headers)).json()["data"]["compliance_due"] == 0


async def test_cctv_consent_and_parent_viewing(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers, "cctv")
    parent, section, ids = s["parent"], s["section"], s["ids"]
    assert (await client.get(f"{API}/cctv/cameras", headers=s["ct"])).status_code == 403
    assert (await client.post(f"{API}/cctv/cameras", headers=admin_headers, json={"name": "Gate", "parent_viewable": True})).status_code == 422
    cam = (await client.post(f"{API}/cctv/cameras", headers=admin_headers, json={"name": "Class 4-A camera", "location": "Room 12", "section_id": str(section.id),
                                                                                 "stream_url": "https://nvr.example.com/live/12.m3u8", "parent_viewable": True})).json()["data"]
    assert cam["section_label"] == "Class 4 – A" and cam["consent"] == {"students": 3, "yes": 0, "no": 0, "unanswered": 3, "complete": False}
    await client.post(f"{API}/cctv/cameras", headers=admin_headers, json={"name": "Corridor", "stream_url": "rtsp://nvr/2"})

    seen = (await client.get(f"{API}/cctv/cameras", headers=parent)).json()["data"]
    assert [c["name"] for c in seen] == ["Class 4-A camera"] and seen[0]["stream_url"] is None
    assert seen[0]["blocked_reason"] == "The school hasn't turned on parent viewing"
    await client.put(f"{API}/cctv/settings", headers=admin_headers, json={"parent_viewing": True})
    assert (await client.get(f"{API}/cctv/cameras", headers=parent)).json()["data"][0]["blocked_reason"] == "Give your consent first"
    assert (await client.put(f"{API}/cctv/consent", headers=s["ct"], json={"student_id": ids[0], "consent": True})).status_code == 403
    assert (await client.put(f"{API}/cctv/consent", headers=parent, json={"student_id": ids[1], "consent": True})).status_code == 404
    rows = (await client.put(f"{API}/cctv/consent", headers=parent, json={"student_id": ids[0], "consent": True})).json()["data"]
    assert rows[0]["consent"] is True
    cam_now = (await client.get(f"{API}/cctv/cameras", headers=parent)).json()["data"][0]
    assert cam_now["blocked_reason"] == "Every family in the class must agree first" and not cam_now["watchable"]
    assert (await client.post(f"{API}/cctv/cameras/{cam['id']}/watch", headers=parent)).json()["error"]["code"] == "NOT_WATCHABLE"

    # The other two families agree; now the parent can watch, and the view is logged.
    for i, sid in enumerate(ids[1:]):
        g = await factories.user(db, school, f"g{i}@t.com", "parent")
        db.add(CctvConsent(school_id=school.id, student_id=sid, guardian_id=g.id, consent=True))
    await db.commit()
    w = (await client.post(f"{API}/cctv/cameras/{cam['id']}/watch", headers=parent)).json()["data"]
    assert w["stream_url"] == "https://nvr.example.com/live/12.m3u8"
    log = (await client.get(f"{API}/cctv/views", headers=admin_headers)).json()["data"]
    assert [(x["camera"], x["user"], x["role"]) for x in log] == [("Class 4-A camera", "Mum Zero", "parent")]
    cov = {c["label"]: (c["yes"], c["no"], c["unanswered"]) for c in (await client.get(f"{API}/cctv/coverage", headers=admin_headers)).json()["data"]}
    assert cov["Class 4 – A"] == (3, 0, 0)

    # One "no" closes viewing for the whole class.
    await client.put(f"{API}/cctv/consent", headers=parent, json={"student_id": ids[0], "consent": False})
    assert not (await client.get(f"{API}/cctv/cameras", headers=parent)).json()["data"][0]["watchable"]
