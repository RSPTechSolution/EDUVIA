"""Question bank, online tests, co-scholastic grades and live classes."""
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.models import OnlineTest, TestAttempt
from tests import factories, test_communication, test_exams
from tests.factories import API, PASSWORD, student_body


async def _setup(client, db, school, headers):
    """test_communication.setup plus a student login in 7 A."""
    a, b, maths, science, student_id, parent_pw = await test_communication.setup(client, db, school, headers)
    body = student_body(a, "OL1", first_name="Esha", login={"email": "esha@t.com", "password": "Esha@12345"})
    esha = (await client.post(f"{API}/students", headers=headers, json=body)).json()["data"]["student"]["id"]
    t = await factories.login_headers(client, "t7@t.com", PASSWORD, school.slug)
    s = await factories.login_headers(client, "esha@t.com", "Esha@12345", school.slug)
    return a, b, maths, science, t, s, esha


def mcq(class_id, subject_id, text, answer="b", marks=1, kind="single"):
    return {"class_id": str(class_id), "subject_id": subject_id, "kind": kind, "text": text, "marks": marks, "answer": [answer] if isinstance(answer, str) else answer,
            "options": [{"id": "a", "text": "One"}, {"id": "b", "text": "Two"}, {"id": "c", "text": "Three"}]}


async def test_question_bank_rules(client, db, school, admin_headers):
    a, b, maths, science, t, s, _ = await _setup(client, db, school, admin_headers)
    bad = await client.post(f"{API}/questions", headers=t, json={**mcq(a.class_id, maths["id"], "1+1?"), "answer": ["z"]})
    assert bad.status_code == 422
    single_two = await client.post(f"{API}/questions", headers=t, json={**mcq(a.class_id, maths["id"], "1+1?"), "answer": ["a", "b"]})
    assert single_two.status_code == 422
    assert (await client.post(f"{API}/questions", headers=t, json=mcq(a.class_id, science["id"], "x"))).status_code == 403  # not their subject
    assert (await client.post(f"{API}/questions", headers=s, json=mcq(a.class_id, maths["id"], "x"))).status_code == 403
    q = (await client.post(f"{API}/questions", headers=t, json=mcq(a.class_id, maths["id"], "1+1?"))).json()["data"]
    tf = (await client.post(f"{API}/questions", headers=t, json={"class_id": str(a.class_id), "subject_id": maths["id"], "kind": "true_false",
                                                                 "text": "0 is even", "answer": ["t"]})).json()["data"]
    assert [o["id"] for o in tf["options"]] == ["t", "f"]
    listed = (await client.get(f"{API}/questions", headers=t, params={"class_id": str(a.class_id)})).json()["data"]
    assert {x["id"] for x in listed} == {q["id"], tf["id"]}
    found = (await client.get(f"{API}/questions", headers=t, params={"class_id": str(a.class_id), "search": "even"})).json()["data"]
    assert [x["id"] for x in found] == [tf["id"]]


async def test_online_test_flow_auto_and_manual_marking(client, db, school, admin_headers):
    a, b, maths, science, t, s, esha = await _setup(client, db, school, admin_headers)
    q1 = (await client.post(f"{API}/questions", headers=t, json=mcq(a.class_id, maths["id"], "1+1?", "b", 2))).json()["data"]
    q2 = (await client.post(f"{API}/questions", headers=t, json=mcq(a.class_id, maths["id"], "Pick odd numbers", ["a", "c"], 2, "multiple"))).json()["data"]
    q3 = (await client.post(f"{API}/questions", headers=t, json={"class_id": str(a.class_id), "subject_id": maths["id"], "kind": "short",
                                                                 "text": "Explain place value", "answer": ["value by position"], "marks": 3})).json()["data"]
    now = datetime.now(UTC)
    body = {"title": "Unit quiz", "class_id": str(a.class_id), "subject_id": maths["id"], "section_ids": [str(a.id)],
            "question_ids": [q1["id"], q2["id"], q3["id"]], "opens_at": (now - timedelta(minutes=5)).isoformat(),
            "closes_at": (now + timedelta(hours=1)).isoformat(), "duration_minutes": 20, "show_results": "after_submit"}
    assert (await client.post(f"{API}/online-tests", headers=t, json={**body, "section_ids": [str(b.id)]})).status_code in (403, 422)
    test = (await client.post(f"{API}/online-tests", headers=t, json=body)).json()["data"]
    assert test["status"] == "draft" and test["max_marks"] == 7 and test["questions"] == 3

    # Not visible until published.
    assert (await client.post(f"{API}/online-tests/{test['id']}/start", headers=s)).status_code == 404
    pub = (await client.post(f"{API}/online-tests/{test['id']}/publish", headers=t)).json()["data"]
    assert pub["status"] == "open"
    mine = (await client.get(f"{API}/online-tests/my", headers=s)).json()["data"]
    assert [(m["title"], m["state"]) for m in mine] == [("Unit quiz", "open")]

    paper = (await client.post(f"{API}/online-tests/{test['id']}/start", headers=s)).json()["data"]
    assert len(paper["questions"]) == 3 and all("answer" not in q for q in paper["questions"])
    again = (await client.post(f"{API}/online-tests/{test['id']}/start", headers=s)).json()["data"]
    assert [q["id"] for q in again["questions"]] == [q["id"] for q in paper["questions"]]  # same order on resume
    # Once a student has started, the teacher can't change the test.
    assert (await client.put(f"{API}/online-tests/{test['id']}", headers=t, json=body)).json()["error"]["code"] == "TEST_STARTED"

    await client.put(f"{API}/online-tests/{test['id']}/answers", headers=s, json={"answers": {q1["id"]: ["b"]}})
    res = (await client.post(f"{API}/online-tests/{test['id']}/submit", headers=s,
                              json={"answers": {q2["id"]: ["a"], q3["id"]: "Each digit has a value by its position"}})).json()["data"]
    assert res["score"] == 2 and res["needs_marking"] and res["released"]
    by = {q["id"]: q for q in res["questions"]}
    assert by[q1["id"]]["awarded"] == 2 and by[q2["id"]]["awarded"] == 0 and by[q3["id"]]["awarded"] is None
    assert (await client.put(f"{API}/online-tests/{test['id']}/answers", headers=s, json={"answers": {}})).json()["error"]["code"] == "TEST_SUBMITTED"

    results = (await client.get(f"{API}/online-tests/{test['id']}/results", headers=t)).json()["data"]
    esha_row = next(r for r in results["rows"] if r["student_id"] == esha)
    assert esha_row["state"] == "submitted" and esha_row["needs_marking"]
    assert {r["state"] for r in results["rows"]} == {"submitted", "not_started"}
    stat = {x["question_id"]: x for x in results["questions"]}
    assert stat[q1["id"]]["correct_percent"] == 100.0 and stat[q2["id"]]["correct_percent"] == 0.0

    assert (await client.put(f"{API}/online-tests/{test['id']}/marks/{esha}", headers=t, json={"marks": {q3["id"]: 9}})).status_code == 422
    marked = (await client.put(f"{API}/online-tests/{test['id']}/marks/{esha}", headers=t, json={"marks": {q3["id"]: 2.5}})).json()["data"]
    assert marked["score"] == 4.5 and not marked["needs_marking"] and marked["percent"] == 64.3


async def test_time_limit_and_results_release(client, db, school, admin_headers):
    a, b, maths, science, t, s, esha = await _setup(client, db, school, admin_headers)
    q1 = (await client.post(f"{API}/questions", headers=t, json=mcq(a.class_id, maths["id"], "1+1?", "b"))).json()["data"]
    now = datetime.now(UTC)
    test = (await client.post(f"{API}/online-tests", headers=t, json={
        "title": "Quick check", "class_id": str(a.class_id), "subject_id": maths["id"], "section_ids": [str(a.id)], "question_ids": [q1["id"]],
        "opens_at": (now - timedelta(minutes=1)).isoformat(), "closes_at": (now + timedelta(hours=2)).isoformat(), "duration_minutes": 5,
        "show_results": "after_close"})).json()["data"]
    await client.post(f"{API}/online-tests/{test['id']}/publish", headers=t)
    await client.post(f"{API}/online-tests/{test['id']}/start", headers=s)
    await client.put(f"{API}/online-tests/{test['id']}/answers", headers=s, json={"answers": {q1["id"]: ["b"]}})
    # The time runs out: the saved answers are submitted automatically.
    await db.execute(update(TestAttempt).values(deadline=datetime.now(UTC) - timedelta(minutes=5)))
    await db.commit()
    late = await client.put(f"{API}/online-tests/{test['id']}/answers", headers=s, json={"answers": {q1["id"]: ["a"]}})
    assert late.json()["error"]["code"] == "TEST_SUBMITTED"
    mine = (await client.get(f"{API}/online-tests/my", headers=s)).json()["data"][0]
    assert mine["state"] == "submitted" and not mine["released"] and mine["score"] is None  # held until the test closes
    await db.execute(update(OnlineTest).values(closes_at=datetime.now(UTC) - timedelta(minutes=1)))
    await db.commit()
    mine = (await client.get(f"{API}/online-tests/my", headers=s)).json()["data"][0]
    assert mine["released"] and mine["score"] == 1 and mine["percent"] == 100.0
    att = await db.scalar(select(TestAttempt))
    assert att.submitted_at is not None


async def test_co_scholastic_on_report_card(client, db, school, admin_headers):
    section, exam, papers, ids, parent_pw = await test_exams.setup(client, db, school, admin_headers)
    areas = (await client.get(f"{API}/co-scholastic/areas", headers=admin_headers)).json()["data"]
    assert [a["name"] for a in areas][:2] == ["Work education", "Art education"]
    t = await factories.login_headers(client, "maths@t.com", PASSWORD, school.slug)
    sheet = (await client.get(f"{API}/co-scholastic/{exam['id']}/{section.id}", headers=t)).json()["data"]
    assert not sheet["editable"]  # not the class teacher
    assert (await client.put(f"{API}/co-scholastic/{exam['id']}/{section.id}", headers=t, json={"grades": {}})).status_code == 403
    saved = (await client.put(f"{API}/co-scholastic/{exam['id']}/{section.id}", headers=admin_headers, json={"grades": {
        ids[0]: {areas[0]["id"]: "A", areas[3]["id"]: "B"}}})).json()["data"]
    assert saved["rows"][0]["grades"] == {areas[0]["id"]: "A", areas[3]["id"]: "B"}
    for subj, values in {"Mathematics": [45, 12, 30], "English": [48, 20, 30]}.items():
        await client.put(f"{API}/exams/papers/{papers[subj]['id']}/sections/{section.id}", headers=admin_headers,
                         json={"entries": [{"student_id": i, "marks": v} for i, v in zip(ids, values)]})
    card = (await client.get(f"{API}/exams/{exam['id']}/report/{ids[0]}", headers=admin_headers)).json()["data"]
    assert card["co_scholastic"] == [{"area": "Work education", "grade": "A"}, {"area": "Discipline", "grade": "B"}]
    pdf = await client.get(f"{API}/exams/{exam['id']}/report/{ids[0]}/pdf", headers=admin_headers)
    assert pdf.status_code == 200
    await client.post(f"{API}/exams/{exam['id']}/publish", headers=admin_headers)
    locked = await client.put(f"{API}/co-scholastic/{exam['id']}/{section.id}", headers=admin_headers, json={"grades": {ids[1]: {areas[0]["id"]: "C"}}})
    assert locked.json()["error"]["code"] == "MARKS_LOCKED"


async def test_live_classes(client, db, school, admin_headers):
    a, b, maths, science, student_id, parent_pw = await test_communication.setup(client, db, school, admin_headers)
    t = await factories.login_headers(client, "t7@t.com", PASSWORD, school.slug)
    p = await factories.login_headers(client, "kdad@t.com", parent_pw, school.slug)
    start = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    assert (await client.post(f"{API}/live-classes", headers=t, json={"title": "Fractions", "section_ids": [str(b.id)], "starts_at": start})).status_code == 403
    assert (await client.post(f"{API}/live-classes", headers=t, json={"title": "Fractions", "section_ids": [str(a.id)], "starts_at": start,
                                                                      "meeting_url": "http://insecure.example"})).status_code == 422
    lc = (await client.post(f"{API}/live-classes", headers=t, json={"title": "Fractions revision", "section_ids": [str(a.id)],
                                                                     "subject_id": maths["id"], "starts_at": start, "duration_minutes": 45})).json()["data"]
    assert lc["meeting_url"].startswith("https://meet.jit.si/eduvia-") and lc["provider"] == "Jitsi" and lc["state"] == "upcoming"
    zoom = (await client.post(f"{API}/live-classes", headers=t, json={"title": "Doubts", "section_ids": [str(a.id)], "starts_at": start,
                                                                       "meeting_url": "https://us02web.zoom.us/j/123"})).json()["data"]
    assert zoom["provider"] == "Zoom"
    seen = (await client.get(f"{API}/live-classes", headers=p)).json()["data"]
    assert {x["title"] for x in seen} == {"Fractions revision", "Doubts"}
    assert any(n["kind"] == "live_class" for n in (await client.get(f"{API}/notifications", headers=p)).json()["data"])
    assert (await client.post(f"{API}/live-classes/{lc['id']}/cancel", headers=p)).status_code == 403
    gone = (await client.post(f"{API}/live-classes/{lc['id']}/cancel", headers=t)).json()["data"]
    assert gone["state"] == "cancelled"
    assert student_id
