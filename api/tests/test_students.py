from tests import factories
from tests.factories import API, PASSWORD, student_body


def fields(res) -> set[str]:
    return {d["field"] for d in res.json()["error"].get("details") or []}


# ---- classes & sections ---------------------------------------------------------------------

async def test_classes_and_sections(client, admin_headers):
    res = await client.post(f"{API}/classes", headers=admin_headers, json={"name": " Class  5 ", "sections": ["a", "b"]})
    assert res.status_code == 201, res.text
    c = res.json()["data"]
    assert c["name"] == "Class 5" and [s["name"] for s in c["sections"]] == ["A", "B"]

    dup = await client.post(f"{API}/classes", headers=admin_headers, json={"name": "class 5"})
    assert dup.status_code == 422 and fields(dup) == {"name"}

    bulk = await client.post(f"{API}/classes/bulk", headers=admin_headers, json={"names": ["Class 5", "Class 6", "Class 7"], "sections": ["A"]})
    assert bulk.json()["data"]["created"] == 2  # Class 5 already exists

    sec = await client.post(f"{API}/classes/{c['id']}/sections", headers=admin_headers, json={"name": "c", "capacity": 30})
    assert sec.json()["data"]["name"] == "C"
    listed = (await client.get(f"{API}/classes", headers=admin_headers)).json()["data"]
    assert [x["name"] for x in listed] == ["Class 5", "Class 6", "Class 7"]


async def test_cannot_delete_classes_or_sections_in_use(client, db, school, admin_headers):
    c, section = await factories.klass(db, school, "Class 1")
    await client.post(f"{API}/students", headers=admin_headers, json=student_body(section, "A1"))
    assert (await client.delete(f"{API}/classes/{c.id}", headers=admin_headers)).json()["error"]["code"] == "CLASS_IN_USE"
    assert (await client.delete(f"{API}/classes/sections/{section.id}", headers=admin_headers)).status_code == 409


# ---- students -----------------------------------------------------------------------------

async def test_student_requires_class_and_core_details(client, admin_headers):
    res = await client.post(f"{API}/students", headers=admin_headers, json={"first_name": "Riya"})
    assert res.status_code == 422
    assert {"last_name", "gender", "date_of_birth", "admission_no", "admission_date", "class_id", "section_id"} <= fields(res)


async def test_student_create_and_validation(client, db, school, admin_headers):
    c1, sec1 = await factories.klass(db, school, "Class 1", capacity=2)
    _, sec2 = await factories.klass(db, school, "Class 2")

    ok = await client.post(f"{API}/students", headers=admin_headers, json=student_body(sec1, "A1", roll_no=1, blood_group="B+"))
    assert ok.status_code == 201, ok.text
    s = ok.json()["data"]["student"]
    assert s["class_name"] == "Class 1" and s["section_name"] == "A" and s["roll_no"] == 1

    wrong_section = await client.post(f"{API}/students", headers=admin_headers, json={**student_body(sec1, "A2"), "section_id": str(sec2.id)})
    assert fields(wrong_section) == {"section_id"}
    dup_adm = await client.post(f"{API}/students", headers=admin_headers, json=student_body(sec1, "a1"))
    assert fields(dup_adm) == {"admission_no"}
    dup_roll = await client.post(f"{API}/students", headers=admin_headers, json=student_body(sec1, "A3", roll_no=1))
    assert fields(dup_roll) == {"roll_no"}
    future = await client.post(f"{API}/students", headers=admin_headers, json={**student_body(sec1, "A4"), "date_of_birth": "2099-01-01"})
    assert future.status_code == 422

    assert (await client.post(f"{API}/students", headers=admin_headers, json=student_body(sec1, "A5"))).status_code == 201
    full = await client.post(f"{API}/students", headers=admin_headers, json=student_body(sec1, "A6"))
    assert fields(full) == {"section_id"} and "full" in full.json()["error"]["details"][0]["message"]

    listed = await client.get(f"{API}/students?class_id={c1.id}", headers=admin_headers)
    assert listed.json()["meta"]["total"] == 2


async def test_new_parent_is_created_and_linked(client, db, school, admin_headers):
    _, sec = await factories.klass(db, school, "Class 3")
    body = student_body(sec, "B1", guardians=[{
        "relationship": "mother", "new_parent": {"full_name": "Kavita Sharma", "phone": "+91 98111 22233", "email": "kavita@home.in"},
    }], login={"email": "riya@alpha.edu", "password": "Student123"})
    res = await client.post(f"{API}/students", headers=admin_headers, json=body)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    pw = data["new_parent_passwords"]["kavita@home.in"]
    g = data["student"]["guardians"][0]
    assert g["relationship"] == "mother" and g["is_primary"] is True
    assert data["student"]["login_email"] == "riya@alpha.edu"

    login = await factories.login(client, "kavita@home.in", pw, "alpha")
    assert login.json()["data"]["user"]["role"] == "parent"
    detail = (await client.get(f"{API}/users/{g['user_id']}", headers=admin_headers)).json()["data"]
    assert detail["children"][0]["name"] == "Riya Sharma" and detail["children"][0]["class_section"] == "Class 3 – A"

    # The parent's only child can't be unlinked.
    rm = await client.delete(f"{API}/students/{data['student']['id']}/guardians/{g['user_id']}", headers=admin_headers)
    assert rm.json()["error"]["code"] == "LAST_CHILD"


# ---- role-specific requirements for users --------------------------------------------------------

BASE = {"full_name": "Someone Kumar", "password": "Passw0rd1"}


async def test_each_role_has_its_own_required_fields(client, db, school, admin_headers):
    async def create(**body):
        return await client.post(f"{API}/users", headers=admin_headers, json={**BASE, **body})

    assert fields(await create(email="t@alpha.edu", role="teacher")) == {"phone"}
    assert fields(await create(email="d@alpha.edu", role="driver", phone="+91 9")) == {"license_no"}
    assert fields(await create(email="p@alpha.edu", role="parent", phone="+91 98")) == {"children"}
    assert fields(await create(email="s@alpha.edu", role="student")) == {"student_id"}
    # Leaders only need the basics.
    assert (await create(email="pr@alpha.edu", role="principal")).status_code == 201
    driver = await create(email="d2@alpha.edu", role="driver", phone="+91 98000 1", license_no="PB10 2020 123", designation="ignored")
    assert driver.status_code == 201 and driver.json()["data"]["license_no"] == "PB10 2020 123"
    assert driver.json()["data"]["designation"] is None  # not a driver field


async def test_parent_and_student_accounts_link_to_records(client, db, school, other_school, admin_headers):
    _, sec = await factories.klass(db, school, "Class 4")
    st = (await client.post(f"{API}/students", headers=admin_headers, json=student_body(sec, "C1"))).json()["data"]["student"]

    parent = await client.post(f"{API}/users", headers=admin_headers, json={
        **BASE, "email": "dad@alpha.edu", "role": "parent", "phone": "+91 98000 2",
        "children": [{"student_id": st["id"], "relationship": "father"}]})
    assert parent.status_code == 201, parent.text

    login = await client.post(f"{API}/users", headers=admin_headers, json={
        **BASE, "email": "kid@alpha.edu", "role": "student", "student_id": st["id"]})
    assert login.status_code == 201
    again = await client.post(f"{API}/users", headers=admin_headers, json={
        **BASE, "email": "kid2@alpha.edu", "role": "student", "student_id": st["id"]})
    assert fields(again) == {"student_id"}

    # Other schools' students can't be linked.
    _, foreign_sec = await factories.klass(db, other_school, "Class 4")
    foreign = await factories.user(db, other_school, "head@beta.edu", "school_admin")
    fh = await factories.login_headers(client, foreign.email, PASSWORD, "beta")
    other = (await client.post(f"{API}/students", headers=fh, json=student_body(foreign_sec, "X1"))).json()["data"]["student"]
    stolen = await client.post(f"{API}/users", headers=admin_headers, json={
        **BASE, "email": "mal@alpha.edu", "role": "parent", "phone": "+91 1",
        "children": [{"student_id": other["id"], "relationship": "father"}]})
    assert fields(stolen) == {"children.0"}
    # ...and aren't visible at all.
    assert (await client.get(f"{API}/students/{other['id']}", headers=admin_headers)).status_code == 404


async def test_linked_roles_cannot_change_and_required_fields_stay_required(client, db, school, admin_headers):
    teacher = await client.post(f"{API}/users", headers=admin_headers, json={**BASE, "email": "tt@alpha.edu", "role": "teacher", "phone": "+91 3"})
    tid = teacher.json()["data"]["id"]
    assert fields(await client.patch(f"{API}/users/{tid}", headers=admin_headers, json={"phone": ""})) == {"phone"}
    to_parent = await client.patch(f"{API}/users/{tid}", headers=admin_headers, json={"role": "parent"})
    assert to_parent.json()["error"]["code"] == "ROLE_CHANGE_NOT_ALLOWED"
    to_driver = await client.patch(f"{API}/users/{tid}", headers=admin_headers, json={"role": "driver"})
    assert fields(to_driver) == {"license_no"}


async def test_permissions_and_module(client, db, school, admin_headers):
    await factories.user(db, school, "teach@alpha.edu", "teacher")
    th = await factories.login_headers(client, "teach@alpha.edu", PASSWORD, "alpha")
    assert (await client.get(f"{API}/students", headers=th)).status_code == 200
    assert (await client.post(f"{API}/classes", headers=th, json={"name": "X"})).status_code == 403

    await client.put(f"{API}/schools/current/modules/students", headers=admin_headers, json={"is_enabled": False})
    off = await client.get(f"{API}/students", headers=admin_headers)
    assert off.status_code == 403 and off.json()["error"]["code"] == "MODULE_DISABLED"


async def test_role_rules_are_published(client):
    rules = (await client.get(f"{API}/meta/roles")).json()["data"]
    assert rules["roles"]["parent"]["required"] == ["phone", "children"]
    assert rules["roles"]["driver"]["required"] == ["phone", "license_no"]
