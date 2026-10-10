"""The class teacher (incharge) runs their class: only they (and the office) take its daily attendance, post class notices,
decide leave and remind parents about fees. A teacher who only teaches a subject in the class cannot. Plus deleting
classes and sections safely."""
import asyncio
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select, update

from app.models import FeeInvoice, Student, User
from app.services import notification_service
from app.services.fee_service import academic_year
from tests import factories, test_communication
from tests.factories import API, PASSWORD, student_body
from tests.test_attendance import school_day, today


async def _setup(client, db, school, admin_headers):
    """7 A: Kiran (with a parent) and a class teacher, Meera; T7 only teaches Maths in 7 A. 8 A: Other."""
    a, b, _, _, kiran, parent_pw = await test_communication.setup(client, db, school, admin_headers)
    meera = await factories.user(db, school, "meera@t.com", "teacher")
    assert (await client.patch(f"{API}/classes/sections/{a.id}", headers=admin_headers, json={"class_teacher_id": str(meera.id)})).status_code == 200
    await factories.user(db, school, "front@t.com", "receptionist")
    await factories.user(db, school, "guard@t.com", "security_guard")
    login = lambda e, pw=PASSWORD: factories.login_headers(client, e, pw, school.slug)  # noqa: E731
    return {
        "a": a, "b": b, "kiran": kiran,
        "other": await db.scalar(select(Student.id).where(Student.admission_no == "C2")),
        "incharge": await login("meera@t.com"), "subject": await login("t7@t.com"),
        "front": await login("front@t.com"), "guard": await login("guard@t.com"), "parent": await login("kdad@t.com", parent_pw),
    }


async def test_only_the_incharge_takes_daily_attendance(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers)
    day = school_day().isoformat()
    body = {"date": day, "records": [{"student_id": s["kiran"], "status": "absent", "remark": "Fever"}]}
    # The incharge sees and marks their class; the subject teacher sees nothing and can't mark.
    cards = (await client.get(f"{API}/attendance/sections", headers=s["incharge"], params={"date": day})).json()["data"]
    assert [(c["label"], c["is_class_teacher"]) for c in cards] == [("Class 7 – A", True)]
    assert (await client.get(f"{API}/attendance/sections", headers=s["subject"], params={"date": day})).json()["data"] == []
    denied = await client.put(f"{API}/attendance/sections/{s['a'].id}", headers=s["subject"], json=body)
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "NOT_YOUR_SECTION" and "class teacher" in denied.json()["error"]["message"]
    roster = (await client.get(f"{API}/attendance/sections/{s['a'].id}", headers=s["subject"], params={"date": day})).json()["data"]
    assert roster["editable"] is False
    assert (await client.put(f"{API}/attendance/sections/{s['b'].id}", headers=s["incharge"],
                             json={"date": day, "records": [{"student_id": str(s["other"]), "status": "present"}]})).status_code == 403
    ok = await client.put(f"{API}/attendance/sections/{s['a'].id}", headers=s["incharge"], json=body)
    assert ok.status_code == 200, ok.text
    # The office (admin) can mark any class; reception can view but not mark.
    assert (await client.put(f"{API}/attendance/sections/{s['b'].id}", headers=admin_headers,
                             json={"date": day, "records": [{"student_id": str(s["other"]), "status": "present"}]})).status_code == 200
    assert (await client.put(f"{API}/attendance/sections/{s['a'].id}", headers=s["front"], json=body)).status_code == 403
    assert len((await client.get(f"{API}/attendance/sections", headers=s["front"], params={"date": day})).json()["data"]) == 2


async def test_qr_scan_in_class_is_for_the_incharge_but_the_gate_scans_anyone(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers)
    if today().weekday() == 6:
        return  # school is closed on Sundays, so scans are refused for everyone
    assert (await client.post(f"{API}/attendance/scan", headers=s["subject"], json={"code": "C1"})).status_code == 403
    assert (await client.post(f"{API}/attendance/scan", headers=s["incharge"], json={"code": "C2"})).json()["error"]["code"] == "NOT_YOUR_SECTION"
    assert (await client.post(f"{API}/attendance/scan", headers=s["incharge"], json={"code": "C1"})).status_code == 200
    assert (await client.post(f"{API}/attendance/scan", headers=s["guard"], json={"code": "C2"})).status_code == 200


async def test_class_notices_and_leave_belong_to_the_incharge(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers)
    assert (await client.get(f"{API}/notices/sections", headers=s["subject"])).json()["data"] == []
    assert [x["label"] for x in (await client.get(f"{API}/notices/sections", headers=s["incharge"])).json()["data"]] == ["Class 7 – A"]
    notice = {"title": "PTM on Saturday", "body": "10 am", "audience": "sections", "section_ids": [str(s["a"].id)]}
    assert (await client.post(f"{API}/notices", headers=s["subject"], json=notice)).status_code == 422
    assert (await client.post(f"{API}/notices", headers=s["incharge"], json=notice)).status_code == 201

    start = (today() + timedelta(days=3)).isoformat()
    leave = (await client.post(f"{API}/leave", headers=s["parent"], json={"student_id": s["kiran"], "from_date": start, "to_date": start,
                                                                           "kind": "family", "reason": "Wedding in the family"})).json()["data"]
    assert (await client.post(f"{API}/leave/{leave['id']}/decide", headers=s["subject"], json={"approve": True})).status_code == 403
    assert (await client.get(f"{API}/leave", headers=s["subject"])).json()["data"] == []
    decided = await client.post(f"{API}/leave/{leave['id']}/decide", headers=s["incharge"], json={"approve": True})
    assert decided.status_code == 200 and decided.json()["data"]["status"] == "approved"


async def test_my_class_overview_and_fee_reminders(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers)
    year = academic_year(today())
    for sid in (s["kiran"], s["other"]):
        db.add(FeeInvoice(school_id=school.id, invoice_no=f"INV-{sid}"[:30], student_id=sid, term="Q1", academic_year=year, issue_date=today() - timedelta(days=40),
                          due_date=today() - timedelta(days=10), total=Decimal(4000), paid=Decimal(1000), status="partial"))
    await db.commit()

    assert (await client.get(f"{API}/classes/my", headers=s["parent"])).status_code == 403
    assert (await client.get(f"{API}/classes/my", headers=s["subject"])).json()["data"] == []
    mine = (await client.get(f"{API}/classes/my", headers=s["incharge"])).json()["data"]
    assert [(c["label"], c["students"], c["students_overdue"], c["overdue_amount"]) for c in mine] == [("Class 7 – A", 1, 1, 3000.0)]
    assert len((await client.get(f"{API}/classes/my", headers=admin_headers)).json()["data"]) == 2

    detail = (await client.get(f"{API}/classes/my/{s['a'].id}", headers=s["incharge"])).json()["data"]
    kid = detail["students"][0]
    assert detail["class_teacher"] == "Meera" and kid["name"].startswith("Kiran") and kid["fee_due"] == 3000.0 and kid["fee_overdue"]
    assert kid["guardians"] == ["Kiran Dad (father) · +91 90000 00021"]
    assert (await client.get(f"{API}/classes/my/{s['b'].id}", headers=s["incharge"])).status_code == 403
    assert (await client.get(f"{API}/classes/my/{s['a'].id}", headers=s["subject"])).status_code == 403

    # Fee reminders: the incharge reminds their own class only.
    assert (await client.post(f"{API}/classes/my/{s['a'].id}/fee-reminders", headers=s["subject"], json={})).status_code == 403
    sent = (await client.post(f"{API}/classes/my/{s['a'].id}/fee-reminders", headers=s["incharge"], json={})).json()["data"]
    assert sent["invoices"] == 1 and sent["families"] >= 1
    await asyncio.gather(*notification_service._running)
    assert any(n["kind"] == "fee_reminder" for n in (await client.get(f"{API}/notifications", headers=s["parent"])).json()["data"])
    other_inv = await db.scalar(select(FeeInvoice).where(FeeInvoice.student_id == s["other"]))
    assert other_inv.last_reminded_at is None  # 8 A's parents weren't reminded


async def test_deleting_classes_and_sections(client, db, school, admin_headers):
    s = await _setup(client, db, school, admin_headers)
    assert (await client.delete(f"{API}/classes/sections/{s['a'].id}", headers=s["incharge"])).status_code == 403
    # A section with current students can't go; nor the last section of a class.
    busy = await client.delete(f"{API}/classes/sections/{s['a'].id}", headers=admin_headers)
    assert busy.status_code == 409 and busy.json()["error"]["code"] == "SECTION_IN_USE" and "1 current student" in busy.json()["error"]["message"]
    c9 = (await client.post(f"{API}/classes", headers=admin_headers, json={"name": "Class 9", "sections": ["A", "B"]})).json()["data"]
    sec_a, sec_b = c9["sections"][0]["id"], c9["sections"][1]["id"]
    assert (await client.delete(f"{API}/classes/sections/{sec_b}", headers=admin_headers)).status_code == 200
    assert (await client.delete(f"{API}/classes/sections/{sec_a}", headers=admin_headers)).json()["error"]["code"] == "LAST_SECTION"
    # A class whose only students have left keeps their history, so it can't be deleted (and says why).
    st = (await client.post(f"{API}/students", headers=admin_headers, json=student_body(type("S", (), {"class_id": c9["id"], "id": sec_a})(), "Z9"))).json()["data"]
    await db.execute(update(Student).where(Student.id == st["student"]["id"]).values(status="left"))
    await db.commit()
    kept = await client.delete(f"{API}/classes/{c9['id']}", headers=admin_headers)
    assert kept.json()["error"]["code"] == "HAS_HISTORY" and "former student" in kept.json()["error"]["message"]
    c10 = (await client.post(f"{API}/classes", headers=admin_headers, json={"name": "Class 10", "sections": ["A"]})).json()["data"]
    assert (await client.delete(f"{API}/classes/{c10['id']}", headers=admin_headers)).status_code == 200
    assert await db.scalar(select(User.id).where(User.email == "meera@t.com"))  # nothing else touched
