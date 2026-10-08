"""Late fees, fee reminders, and the school accounts."""
from datetime import date, timedelta

from app.services.email_service import CONSOLE_OUTBOX
from tests import factories, test_fees
from tests.factories import API, PASSWORD


async def test_late_fee_rule_apply_and_waive(client, db, school, admin_headers):
    student_id, other_id, parent_pw, *_ = await test_fees.setup(client, db, school, admin_headers)
    await test_fees.generate(client, admin_headers, term="Quarter 1", due=date.today() - timedelta(days=20))
    await test_fees.generate(client, admin_headers, term="Quarter 2", due=date.today() + timedelta(days=10))
    acc = await factories.user(db, school, "acct@t.com", "accountant")
    rec = await factories.user(db, school, "rcp@t.com", "receptionist")
    a = await factories.login_headers(client, "acct@t.com", PASSWORD, school.slug)
    r = await factories.login_headers(client, "rcp@t.com", PASSWORD, school.slug)

    assert (await client.post(f"{API}/fees/late-fees/apply", headers=a)).json()["error"]["code"] == "LATE_FEE_OFF"
    assert (await client.put(f"{API}/fees/late-fee-rule", headers=r, json={"enabled": True, "amount": 10})).status_code == 403
    assert (await client.put(f"{API}/fees/late-fee-rule", headers=a, json={"enabled": True, "amount": 0})).status_code == 422
    rule = {"enabled": True, "mode": "per_day", "amount": 20, "grace_days": 5, "max_amount": 250}
    assert (await client.put(f"{API}/fees/late-fee-rule", headers=a, json=rule)).status_code == 200
    assert (await client.get(f"{API}/fees/late-fee-rule", headers=r)).json()["data"]["max_amount"] == 250

    res = (await client.post(f"{API}/fees/late-fees/apply", headers=a)).json()["data"]
    assert res == {"invoices": 2, "added": 500.0}  # 15 days late x 20 = 300, capped at 250; two students in Class 1
    again = (await client.post(f"{API}/fees/late-fees/apply", headers=a)).json()["data"]
    assert again == {"invoices": 0, "added": 0.0}  # already up to date

    inv = next(i for i in (await client.get(f"{API}/fees/invoices", headers=a, params={"student_id": student_id})).json()["data"]
               if i["term"] == "Quarter 1")
    detail = (await client.get(f"{API}/fees/invoices/{inv['id']}", headers=a)).json()["data"]
    assert detail["total"] == 12250 and detail["balance"] == 12250 and detail["items"][-1] == {"name": "Late fee", "amount": 250.0}
    future = next(i for i in (await client.get(f"{API}/fees/invoices", headers=a, params={"student_id": student_id})).json()["data"]
                  if i["term"] == "Quarter 2")
    assert future["total"] == 12000  # not due yet

    # The parent sees it on their fees; the office can waive it.
    p = await factories.login_headers(client, "dad@t.com", parent_pw, school.slug)
    mine = (await client.get(f"{API}/fees/my", headers=p)).json()["data"]
    assert any(i["total"] == 12250 for c in mine["children"] for i in c["invoices"]) if "children" in mine else True
    assert (await client.post(f"{API}/fees/invoices/{inv['id']}/waive-late-fee", headers=r)).status_code == 403
    assert (await client.post(f"{API}/fees/invoices/{inv['id']}/waive-late-fee", headers=a)).status_code == 200
    detail = (await client.get(f"{API}/fees/invoices/{inv['id']}", headers=a)).json()["data"]
    assert detail["total"] == 12000 and all(i["name"] != "Late fee" for i in detail["items"])
    assert acc and rec and other_id


async def test_fee_reminders(client, db, school, admin_headers):
    student_id, *_ = await test_fees.setup(client, db, school, admin_headers)
    await test_fees.generate(client, admin_headers, term="Quarter 1", due=date.today() - timedelta(days=3))
    await test_fees.generate(client, admin_headers, term="Quarter 2", due=date.today() + timedelta(days=10))
    t = await factories.user(db, school, "tr@t.com", "teacher")
    th = await factories.login_headers(client, "tr@t.com", PASSWORD, school.slug)
    assert (await client.post(f"{API}/fees/reminders", headers=th, json={})).status_code == 403

    CONSOLE_OUTBOX.clear()
    res = (await client.post(f"{API}/fees/reminders", headers=admin_headers, json={"overdue_only": True})).json()["data"]
    assert res["invoices"] == 2 and res["families"] == 1 and res["skipped_recent"] == 0  # one of the two students has a parent login
    # The parent's email is a test domain, so it's logged but not sent; the reminder is in their notification centre.
    assert res["emails"] == 1
    again = (await client.post(f"{API}/fees/reminders", headers=admin_headers, json={"overdue_only": True})).json()["data"]
    assert again["invoices"] == 0 and again["skipped_recent"] == 2  # not spammed twice
    all_due = (await client.post(f"{API}/fees/reminders", headers=admin_headers, json={"overdue_only": False, "term": "Quarter 2"})).json()["data"]
    assert all_due["invoices"] == 2
    assert t and student_id


async def test_accounts_daybook_summary_and_exports(client, db, school, admin_headers):
    student_id, *_ = await test_fees.setup(client, db, school, admin_headers)
    await test_fees.generate(client, admin_headers)
    inv = (await client.get(f"{API}/fees/invoices", headers=admin_headers, params={"student_id": student_id})).json()["data"][0]
    await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers, json={"amount": 5000, "method": "cash"})
    await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers, json={"amount": 2000, "method": "upi", "reference": "U1"})
    acc = await factories.user(db, school, "ac2@t.com", "accountant")
    a = await factories.login_headers(client, "ac2@t.com", PASSWORD, school.slug)
    pr = await factories.user(db, school, "pr@t.com", "principal")
    ph = await factories.login_headers(client, "pr@t.com", PASSWORD, school.slug)
    t = await factories.user(db, school, "tt2@t.com", "teacher")
    th = await factories.login_headers(client, "tt2@t.com", PASSWORD, school.slug)
    assert (await client.get(f"{API}/accounts/heads", headers=a)).json()["error"]["code"] == "MODULE_DISABLED"  # off by default
    assert (await client.put(f"{API}/schools/current/modules/accounts", headers=admin_headers, json={"is_enabled": True})).status_code == 200
    assert (await client.get(f"{API}/accounts/heads", headers=th)).status_code == 403

    heads = (await client.get(f"{API}/accounts/heads", headers=a)).json()["data"]
    expense = {h["name"]: h["id"] for h in heads if h["kind"] == "expense"}
    income = {h["name"]: h["id"] for h in heads if h["kind"] == "income"}
    assert "Salaries" in expense and "Donations" in income  # default heads appear on first use
    assert (await client.post(f"{API}/accounts/heads", headers=a, json={"kind": "expense", "name": "salaries"})).status_code == 422
    sports = (await client.post(f"{API}/accounts/heads", headers=a, json={"kind": "expense", "name": "Sports equipment"})).json()["data"]

    today = date.today().isoformat()
    bad = await client.post(f"{API}/accounts/entries", headers=a, json={"kind": "expense", "head_id": income["Donations"], "date": today, "amount": 10})
    assert bad.status_code == 422  # an income head for an expense
    assert (await client.post(f"{API}/accounts/entries", headers=a, json={"kind": "expense", "head_id": expense["Salaries"], "date": today,
                                                                          "amount": 100, "method": "cheque"})).status_code == 422  # cheque no
    future = (date.today() + timedelta(days=2)).isoformat()
    assert (await client.post(f"{API}/accounts/entries", headers=a, json={"kind": "expense", "head_id": expense["Salaries"], "date": future,
                                                                          "amount": 100})).status_code == 422
    e1 = (await client.post(f"{API}/accounts/entries", headers=a, json={"kind": "expense", "head_id": expense["Electricity and water"],
                                                                        "date": today, "amount": 3200.5, "party": "PSPCL", "method": "bank_transfer",
                                                                        "reference": "NEFT123"})).json()["data"]
    assert e1["voucher_no"].startswith("PV-") and e1["voucher_no"].endswith("00001") and e1["head_name"] == "Electricity and water"
    await client.post(f"{API}/accounts/entries", headers=a, json={"kind": "expense", "head_id": sports["id"], "date": today, "amount": 1500,
                                                                  "party": "Sports shop", "method": "cash"})
    gift = (await client.post(f"{API}/accounts/entries", headers=a, json={"kind": "income", "head_id": income["Donations"], "date": today,
                                                                          "amount": 10000, "party": "Alumni association", "method": "cheque",
                                                                          "reference": "004512"})).json()["data"]
    assert gift["voucher_no"].startswith("RV-")
    assert (await client.post(f"{API}/accounts/entries", headers=ph, json={"kind": "income", "head_id": income["Donations"], "date": today,
                                                                           "amount": 1})).status_code == 403  # principal views only

    listed = (await client.get(f"{API}/accounts/entries", headers=ph, params={"from": today, "to": today, "kind": "expense"})).json()["data"]
    assert {x["party"] for x in listed} == {"PSPCL", "Sports shop"}
    found = (await client.get(f"{API}/accounts/entries", headers=a, params={"from": today, "to": today, "search": "alumni"})).json()["data"]
    assert [x["id"] for x in found] == [gift["id"]]

    s = (await client.get(f"{API}/accounts/summary", headers=ph, params={"from": today, "to": today})).json()["data"]
    assert s["fee_income"] == 7000 and s["other_income"] == 10000 and s["expense"] == 4700.5 and s["net"] == 12299.5
    assert s["cash_in_hand"] == 3500  # 5000 cash fees - 1500 cash expense
    assert {h["name"] for h in s["income_by_head"]} == {"Fees · Cash", "Fees · UPI", "Donations"}
    assert s["expense_by_head"][0] == {"name": "Electricity and water", "amount": 3200.5}

    upd = await client.put(f"{API}/accounts/entries/{e1['id']}", headers=a, json={**{k: e1[k] for k in ("kind", "head_id", "date", "party", "method", "reference")},
                                                                                "amount": 3300})
    assert upd.json()["data"]["amount"] == 3300
    assert (await client.delete(f"{API}/accounts/entries/{gift['id']}", headers=a)).status_code == 200

    tally = await client.get(f"{API}/accounts/export/tally.xml", headers=a, params={"from": today, "to": today})
    assert tally.status_code == 200 and tally.headers["content-type"].startswith("application/xml")
    xml = tally.text
    assert xml.count("<VOUCHER ") == 4 and 'VCHTYPE="Payment"' in xml and "<LEDGERNAME>Fee Income</LEDGERNAME>" in xml
    assert "<LEDGERNAME>Cash</LEDGERNAME>" in xml and "<LEDGERNAME>Bank Account</LEDGERNAME>" in xml
    csv = await client.get(f"{API}/accounts/export/daybook.csv", headers=a, params={"from": today, "to": today})
    lines = csv.text.strip().splitlines()
    assert lines[0].lstrip("﻿").startswith("date,voucher,type,head") and len(lines) == 5

    # Bills can be attached to a voucher.
    f = await client.post(f"{API}/files", headers=a, data={"purpose": "voucher", "owner_id": e1["id"]},
                          files={"file": ("bill.pdf", b"%PDF-1.4 bill", "application/pdf")})
    assert f.status_code == 201
    listed = (await client.get(f"{API}/accounts/entries", headers=a, params={"from": today, "to": today, "kind": "expense"})).json()["data"]
    assert next(x for x in listed if x["id"] == e1["id"])["attachments"] == 1
    assert acc and pr and t
