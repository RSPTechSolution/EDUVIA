from datetime import date, timedelta

from tests import factories
from tests.factories import API, PASSWORD, student_body


async def setup(client, db, school, headers):
    """Two classes, tuition + transport for Class 1, one student with a parent account."""
    c1, s1 = await factories.klass(db, school, "Class 1")
    c2, s2 = await factories.klass(db, school, "Class 2")
    tuition = (await client.post(f"{API}/fees/categories", headers=headers, json={"name": "Tuition"})).json()["data"]
    transport = (await client.post(f"{API}/fees/categories", headers=headers, json={"name": "Transport"})).json()["data"]
    matrix = await client.put(f"{API}/fees/structures", headers=headers, json={"class_id": str(c1.id), "items": [
        {"category_id": tuition["id"], "amount": 9000}, {"category_id": transport["id"], "amount": 3000}]})
    assert matrix.status_code == 200, matrix.text
    row = next(c for c in matrix.json()["data"]["classes"] if c["class_name"] == "Class 1")
    assert row["total"] == 12000 and row["amounts"][tuition["id"]] == 9000

    body = student_body(s1, "A1", guardians=[{"new_parent": {"full_name": "Dad One", "phone": "+91 90000 00009", "email": "dad@t.com"}, "relationship": "father"}])
    created = (await client.post(f"{API}/students", headers=headers, json=body)).json()["data"]
    other = (await client.post(f"{API}/students", headers=headers, json=student_body(s1, "A2", first_name="Other"))).json()["data"]
    await client.post(f"{API}/students", headers=headers, json=student_body(s2, "B1", first_name="NoFees"))
    return created["student"]["id"], other["student"]["id"], created["new_parent_passwords"]["dad@t.com"], tuition, transport


async def generate(client, headers, term="Quarter 1", due=None):
    due = due or (date.today() + timedelta(days=10))
    return await client.post(f"{API}/fees/invoices/generate", headers=headers, json={"term": term, "due_date": due.isoformat()})


async def test_generate_collect_and_discount(client, db, school, admin_headers):
    student_id, _, _, _, _ = await setup(client, db, school, admin_headers)
    res = (await generate(client, admin_headers)).json()["data"]
    assert res == {"created": 2, "skipped_existing": 0, "skipped_zero": 1, "total_billed": 24000.0}
    again = (await generate(client, admin_headers)).json()["data"]
    assert again["created"] == 0 and again["skipped_existing"] == 2  # never billed twice for a term

    rows = (await client.get(f"{API}/fees/invoices", headers=admin_headers, params={"student_id": student_id})).json()["data"]
    inv = rows[0]
    assert inv["total"] == 12000 and inv["balance"] == 12000 and inv["status"] == "unpaid" and inv["invoice_no"].startswith("INV-")

    too_much = await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers, json={"amount": 20000, "method": "cash"})
    assert too_much.status_code == 422
    cheque = await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers, json={"amount": 100, "method": "cheque"})
    assert cheque.status_code == 422  # cheque needs a number

    paid = await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers,
                             json={"amount": 5000, "method": "upi", "reference": "UPI123"})
    assert paid.status_code == 201, paid.text
    receipt_id = paid.json()["data"]["id"]
    assert paid.json()["data"]["receipt_no"].startswith("RCT-")

    detail = (await client.put(f"{API}/fees/invoices/{inv['id']}/discount", headers=admin_headers,
                               json={"amount": 1000, "reason": "Sibling concession"})).json()["data"]
    assert detail["status"] == "partial" and detail["balance"] == 6000 and detail["discount_reason"] == "Sibling concession"
    assert [i["name"] for i in detail["items"]] == ["Tuition", "Transport"]

    rest = await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers, json={"amount": 6000, "method": "cash"})
    assert rest.status_code == 201
    final = (await client.get(f"{API}/fees/invoices/{inv['id']}", headers=admin_headers)).json()["data"]
    assert final["status"] == "paid" and final["balance"] == 0 and len(final["payments"]) == 2
    assert (await client.post(f"{API}/fees/invoices/{inv['id']}/payments", headers=admin_headers,
                              json={"amount": 1, "method": "cash"})).json()["error"]["code"] == "ALREADY_PAID"

    receipt = (await client.get(f"{API}/fees/payments/{receipt_id}/receipt", headers=admin_headers)).json()["data"]
    assert receipt["payment"]["amount"] == 5000 and receipt["balance_after"] == 6000  # after the concession

    summary = (await client.get(f"{API}/fees/summary", headers=admin_headers)).json()["data"]
    assert summary["collected_today"] == 11000 and summary["outstanding"] == 12000  # the other student's invoice
    assert {m["method"] for m in summary["by_method"]} == {"upi", "cash"}


async def test_parent_sees_dues_but_fees_are_not_paid_online(client, db, school, admin_headers):
    """Parents see what's due; the office records payments. School fees are never paid online through Vidyanexa."""
    student_id, other_id, parent_pw, _, _ = await setup(client, db, school, admin_headers)
    await generate(client, admin_headers, "Quarter 1", date.today() - timedelta(days=5))
    p = await factories.login_headers(client, "dad@t.com", parent_pw, school.slug)

    mine = (await client.get(f"{API}/fees/my", headers=p)).json()["data"]
    assert mine["total_due"] == 12000 and "online_payments" not in mine
    child = mine["children"][0]
    assert child["student_id"] == student_id and child["overdue"] == 12000 and child["invoices"][0]["overdue"]
    assert (await client.get(f"{API}/fees/invoices", headers=p)).status_code == 403

    inv_id = child["invoices"][0]["id"]
    assert (await client.post(f"{API}/fees/invoices/{inv_id}/pay", headers=p)).status_code in (404, 405)

    # The office records the payment; the parent sees it and can open the receipt.
    paid = (await client.post(f"{API}/fees/invoices/{inv_id}/payments", headers=admin_headers,
                              json={"amount": 12000, "method": "upi", "reference": "UPI-1"})).json()["data"]
    after = (await client.get(f"{API}/fees/my", headers=p)).json()["data"]
    assert after["total_due"] == 0 and after["children"][0]["invoices"][0]["status"] == "paid"
    assert (await client.get(f"{API}/fees/payments/{paid['id']}/receipt", headers=p)).status_code == 200


async def test_permissions_and_isolation(client, db, school, other_school, admin_headers):
    await setup(client, db, school, admin_headers)
    await factories.user(db, school, "acc@t.com", "accountant")
    await factories.user(db, school, "rec@t.com", "receptionist")
    await factories.user(db, school, "tea@t.com", "teacher")
    acc = await factories.login_headers(client, "acc@t.com", PASSWORD, school.slug)
    rec = await factories.login_headers(client, "rec@t.com", PASSWORD, school.slug)
    tea = await factories.login_headers(client, "tea@t.com", PASSWORD, school.slug)
    assert (await generate(client, acc)).status_code == 200  # accountant manages fees
    assert (await generate(client, rec, "Quarter 2")).status_code == 403  # receptionist only collects
    assert (await client.get(f"{API}/fees/invoices", headers=rec)).status_code == 200
    assert (await client.get(f"{API}/fees/summary", headers=tea)).status_code == 403

    await factories.user(db, other_school, "boss@o.com", "school_admin")
    o = await factories.login_headers(client, "boss@o.com", PASSWORD, other_school.slug)
    assert (await client.get(f"{API}/fees/invoices", headers=o)).json()["data"] == []
    assert (await client.get(f"{API}/fees/categories", headers=o)).json()["data"] == []
