"""HR: staff profiles, staff attendance, leave, payroll and payslips."""
import calendar
from datetime import date, timedelta

from app.services.hr_service import compute
from tests import factories
from tests.factories import API, PASSWORD
from tests.test_attendance import today


def last_month() -> str:
    first = today().replace(day=1) - timedelta(days=1)
    return first.strftime("%Y-%m")


def weekday_in(month: str, n: int = 0):
    """The n-th Monday-to-Saturday date in a YYYY-MM month."""
    y, m = map(int, month.split("-"))
    days = [date(y, m, d) for d in range(1, calendar.monthrange(y, m)[1] + 1) if date(y, m, d).weekday() != 6]
    return days[n]


async def test_profile_permissions_and_payroll(client, db, school, admin_headers):
    hr = await factories.user(db, school, "hr1@t.com", "hr_manager")
    acc = await factories.user(db, school, "acc1@t.com", "accountant")
    t = await factories.user(db, school, "pay1@t.com", "teacher")
    t2 = await factories.user(db, school, "pay2@t.com", "teacher")
    h = await factories.login_headers(client, "hr1@t.com", PASSWORD, school.slug)
    a = await factories.login_headers(client, "acc1@t.com", PASSWORD, school.slug)
    th = await factories.login_headers(client, "pay1@t.com", PASSWORD, school.slug)

    assert (await client.get(f"{API}/hr/staff", headers=th)).status_code == 403
    assert (await client.get(f"{API}/hr/staff/{t2.id}", headers=th)).status_code == 403  # someone else's
    assert (await client.get(f"{API}/hr/staff/{t.id}", headers=th)).status_code == 200  # their own
    bad = await client.put(f"{API}/hr/staff/{t.id}", headers=h, json={"pan": "123", "basic": 10})
    assert bad.status_code == 422
    assert (await client.put(f"{API}/hr/staff/{t.id}", headers=a, json={"basic": 10})).status_code == 403
    profile = {"department": "Mathematics", "date_of_joining": "2020-06-01", "pan": "abcde1234f", "bank_name": "SBI", "bank_account": "30123456789",
               "ifsc": "sbin0001234", "basic": 30000, "hra": 12000, "da": 3000, "conveyance": 1600, "special": 3400, "professional_tax": 200, "tds": 1500}
    res = await client.put(f"{API}/hr/staff/{t.id}", headers=h, json=profile)
    assert res.status_code == 200, res.text
    d = res.json()["data"]
    assert d["gross_monthly"] == 50000 and d["has_bank"] and d["profile"]["pan"] == "ABCDE1234F"
    await client.put(f"{API}/hr/staff/{t2.id}", headers=h, json={"basic": 12000, "hra": 3000, "date_of_joining": "2019-01-01"})

    # Last month: the teacher was absent two days and had a half day; the other took unpaid leave for one day.
    month = last_month()
    lwp = next(x for x in (await client.get(f"{API}/hr/leave-types", headers=h)).json()["data"] if x["code"] == "LWP")
    marks = [(weekday_in(month, 2), "absent"), (weekday_in(month, 3), "absent"), (weekday_in(month, 4), "half_day")]
    for day, status in marks:
        assert (await client.put(f"{API}/hr/attendance", headers=h, json={"date": day.isoformat(), "records": [{"user_id": str(t.id), "status": status}]})).status_code == 200
    leave = (await client.post(f"{API}/hr/leave", headers=h, json={"leave_type_id": lwp["id"], "from_date": weekday_in(month, 6).isoformat(),
                                                                   "to_date": weekday_in(month, 6).isoformat(), "reason": "Family work", "user_id": str(t2.id)})).json()["data"]
    assert leave["status"] == "pending"
    await client.post(f"{API}/hr/leave/{leave['id']}/decide", headers=admin_headers, json={"approve": True})

    run = (await client.post(f"{API}/hr/payroll", headers=a, json={"month": month})).json()["data"]
    slips = {s["full_name"]: s for s in run["payslips"]}
    days = calendar.monthrange(*map(int, month.split("-")))[1]
    p1 = slips["Pay1"]
    assert p1["lop_days"] == 2.5 and p1["paid_days"] == days - 2.5
    ratio = (days - 2.5) / days
    assert abs(p1["earnings"]["Basic"] - round(30000 * ratio, 2)) < 0.01
    assert p1["deductions"]["Provident fund"] == 1800.0  # 12% of basic+DA, capped at 15,000
    assert p1["deductions"]["Income tax (TDS)"] == 1500 and "ESI" not in p1["deductions"]
    p2 = slips["Pay2"]
    assert p2["lop_days"] == 1 and "ESI" in p2["deductions"]  # gross under 21,000

    # Adjust (bonus and advance recovery), finalise, then it can't change; the staff member gets the payslip.
    adj = (await client.put(f"{API}/hr/payroll/{run['id']}/payslips/{p1['id']}", headers=a, json={"adjustments": {"Bonus": 2000, "Advance recovery": -1000}})).json()["data"]
    p1b = next(s for s in adj["payslips"] if s["id"] == p1["id"])
    assert p1b["earnings"]["Bonus"] == 2000 and p1b["deductions"]["Advance recovery"] == 1000 and round(p1b["net"] - p1["net"], 2) == 1000
    assert (await client.get(f"{API}/hr/my/payslips", headers=th)).json()["data"] == []  # drafts are hidden
    fin = (await client.post(f"{API}/hr/payroll/{run['id']}/finalise", headers=a)).json()["data"]
    assert fin["status"] == "finalised"
    assert (await client.post(f"{API}/hr/payroll", headers=a, json={"month": month})).json()["error"]["code"] == "PAYROLL_FINAL"
    mine = (await client.get(f"{API}/hr/my/payslips", headers=th)).json()["data"]
    assert len(mine) == 1 and mine[0]["net"] == p1b["net"]
    pdf = await client.get(f"{API}/hr/payslips/{p1['id']}/pdf", headers=th)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    t2h = await factories.login_headers(client, "pay2@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/hr/payslips/{p1['id']}/pdf", headers=t2h)).status_code == 404
    advice = await client.get(f"{API}/hr/payroll/{run['id']}/bank-advice.csv", headers=a)
    assert "30123456789" in advice.text and "SBIN0001234" in advice.text
    assert (await client.post(f"{API}/hr/payroll/{run['id']}/paid", headers=a, json={"paid_on": today().isoformat()})).json()["data"]["status"] == "paid"
    assert hr and acc


async def test_staff_leave_balance_and_approval(client, db, school, admin_headers):
    t = await factories.user(db, school, "lv@t.com", "teacher")
    hr = await factories.user(db, school, "hr2@t.com", "hr_manager")
    th = await factories.login_headers(client, "lv@t.com", PASSWORD, school.slug)
    h = await factories.login_headers(client, "hr2@t.com", PASSWORD, school.slug)
    types = {x["code"]: x for x in (await client.get(f"{API}/hr/leave-types", headers=th)).json()["data"]}
    assert {"CL", "SL", "EL", "LWP"} <= set(types)
    start = today() + timedelta(days=7)
    start += timedelta(days=1) if start.weekday() == 6 else timedelta(0)
    too_many = await client.post(f"{API}/hr/leave", headers=th, json={"leave_type_id": types["CL"]["id"], "from_date": start.isoformat(),
                                                                       "to_date": (start + timedelta(days=20)).isoformat(), "reason": "Long trip"})
    assert too_many.status_code == 422  # only 12 casual leave days
    r = (await client.post(f"{API}/hr/leave", headers=th, json={"leave_type_id": types["CL"]["id"], "from_date": start.isoformat(),
                                                                 "to_date": start.isoformat(), "reason": "Bank work", "half_day": True})).json()["data"]
    assert r["days"] == 0.5 and r["can_cancel"]
    bal = {b["code"]: b for b in (await client.get(f"{API}/hr/my/leave-balance", headers=th)).json()["data"]}
    assert bal["CL"]["left"] == 11.5
    assert (await client.post(f"{API}/hr/leave/{r['id']}/decide", headers=th, json={"approve": True})).status_code == 403
    assert any(n["kind"] == "staff_leave" for n in (await client.get(f"{API}/notifications", headers=h)).json()["data"])
    ok = (await client.post(f"{API}/hr/leave/{r['id']}/decide", headers=h, json={"approve": True, "note": "Fine"})).json()["data"]
    assert ok["status"] == "approved"
    sheet = (await client.get(f"{API}/hr/attendance", headers=h, params={"date": start.isoformat()})).json()["data"]
    if start <= today():
        assert next(x for x in sheet if x["full_name"] == "Lv")["status"] == "half_day"
    else:
        assert next(x for x in sheet if x["full_name"] == "Lv")["on_leave"]
    cancelled = (await client.post(f"{API}/hr/leave/{r['id']}/cancel", headers=th)).json()["data"]
    assert cancelled["status"] == "cancelled"
    assert t and hr


def test_compute_rules():
    class P:
        basic, hra, da, conveyance, special = 20000, 8000, 0, 0, 0
        pf_enabled, esi_enabled, professional_tax, tds = True, True, 200, 0
    from decimal import Decimal
    for k in ("basic", "hra", "da", "conveyance", "special", "professional_tax", "tds"):
        setattr(P, k, Decimal(getattr(P, k)))
    earnings, deductions, gross, total, net = compute(P, 30, Decimal(0), {})
    assert gross == 28000 and deductions["Provident fund"] == 1800 and "ESI" not in deductions and deductions["Professional tax"] == 200
    _, _, gross2, _, _ = compute(P, 30, Decimal(15), {})
    assert gross2 == 14000
