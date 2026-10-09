"""School analytics."""
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.models import AttendanceRecord, Exam, ExamMark, ExamPaper, FeeInvoice, FeePayment, Subject
from app.services.fee_service import academic_year
from tests import factories, test_attendance
from tests.factories import API, PASSWORD
from tests.test_attendance import today


async def test_analytics_report(client, db, school, admin_headers):
    section, ids, _, _, _ = await test_attendance.setup(client, db, school, admin_headers)
    sids = [uuid.UUID(i) for i in ids]
    await factories.user(db, school, "t1@t.com", "teacher")
    t = await factories.login_headers(client, "t1@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/analytics", headers=t)).status_code == 403

    # Twelve school days: Kid0 always present, Kid1 absent 6 times (50%), Kid2 late twice and on leave once.
    days, d = [], today()
    while len(days) < 12:
        if d.weekday() != 6:
            days.append(d)
        d -= timedelta(days=1)
    for i, day in enumerate(days):
        for k, s in enumerate(sids):
            status = "present"
            if k == 1 and i % 2 == 0:
                status = "absent"
            if k == 2 and i in (1, 2):
                status = "late"
            if k == 2 and i == 3:
                status = "leave"
            db.add(AttendanceRecord(school_id=school.id, student_id=s, section_id=section.id, date=day, status=status))

    # Fees: Kid0 paid in full; Kid2 owes 4,000, 70 days overdue.
    year = academic_year(today())
    for k, (total, paid, due_ago) in enumerate([(10000, 10000, 20), (5000, 0, -10), (6000, 2000, 70)]):
        inv = FeeInvoice(school_id=school.id, invoice_no=f"INV-{k}", student_id=sids[k], term="Q1", academic_year=year, issue_date=today() - timedelta(days=90),
                         due_date=today() - timedelta(days=due_ago), total=Decimal(total), paid=Decimal(paid),
                         status="paid" if paid == total else "partial" if paid else "unpaid")
        db.add(inv)
        await db.flush()
        if paid:
            db.add(FeePayment(school_id=school.id, receipt_no=f"R-{k}", invoice_id=inv.id, amount=Decimal(paid), method="cash", paid_at=datetime.now(UTC)))

    # A published exam: Kid1 fails Maths.
    maths = Subject(school_id=school.id, name="Maths")
    eng = Subject(school_id=school.id, name="English")
    exam = Exam(school_id=school.id, name="Term 1", academic_year=year, published_at=datetime.now(UTC))
    db.add_all([maths, eng, exam])
    await db.flush()
    for subject, marks in ((maths, [90, 20, 60]), (eng, [80, 50, 70])):
        p = ExamPaper(school_id=school.id, exam_id=exam.id, class_id=section.class_id, subject_id=subject.id, max_marks=Decimal(100), pass_marks=Decimal(33))
        db.add(p)
        await db.flush()
        for s, m in zip(sids, marks):
            db.add(ExamMark(school_id=school.id, paper_id=p.id, student_id=s, marks=Decimal(m), entered_at=datetime.now(UTC)))
    await db.commit()

    r = (await client.get(f"{API}/analytics", headers=admin_headers)).json()["data"]
    assert r["students"] == 3 and r["enrolment"] == [{"class_id": str(section.class_id), "name": "Class 4", "students": 3, "boys": 0, "girls": 3}]
    # (12 + 6 + 11) attended of (12 + 12 + 11) countable days.
    assert r["attendance_percent"] == round(100 * 29 / 35, 1)
    assert r["low_attendance"] == 1 and len(r["attendance_trend"]) == 12
    f = r["fees"]
    assert (f["billed"], f["collected"], f["outstanding"]) == (21000.0, 12000.0, 9000.0) and f["collection_percent"] == round(100 * 12 / 21, 1)
    aging = {a["label"]: a["amount"] for a in f["aging"]}
    assert aging["Not due yet"] == 5000.0 and aging["61–90 days"] == 4000.0
    assert f["monthly"][-1]["amount"] == 12000.0 and len(f["monthly"]) == 12
    assert [(x["name"], x["balance"], x["days_overdue"]) for x in f["defaulters"]] == [("Kid2 Sharma", 4000.0, 70)]
    e = r["exam"]
    assert e["name"] == "Term 1" and e["pass_rate"] == round(100 * 2 / 3, 1)
    assert e["classes"][0]["average"] == round((85 + 35 + 65) / 3, 1)
    assert [s["name"] for s in e["subjects"]] == ["Maths", "English"]
    risk = {x["name"]: x["reasons"] for x in r["at_risk"]}
    assert risk == {"Kid1 Sharma": ["Attendance 50.0%", "Below pass mark in 1 paper"], "Kid2 Sharma": ["Fees overdue 70 days"]}
    assert (await client.get(f"{API}/analytics", headers=admin_headers, params={"from": "2026-05-01", "to": "2026-01-01"})).status_code == 400
