"""Transport: fleet, routes, riders, trips with GPS and boarding, family tracking, SOS."""
from sqlalchemy import select

from app.models import MessageLog
from tests import factories, test_attendance
from tests.factories import API, PASSWORD


async def _setup(client, db, school, headers):
    assert (await client.put(f"{API}/schools/current/modules/transport", headers=headers, json={"is_enabled": True})).status_code == 200
    section, ids, parent_pw, _, _ = await test_attendance.setup(client, db, school, headers)
    driver = await factories.user(db, school, "drv@t.com", "driver")
    tm = await factories.user(db, school, "tm@t.com", "transport_manager")
    return section, ids, parent_pw, driver, tm


async def test_fleet_routes_and_riders(client, db, school, admin_headers):
    section, ids, parent_pw, driver, tm = await _setup(client, db, school, admin_headers)
    m = await factories.login_headers(client, "tm@t.com", PASSWORD, school.slug)
    t = await factories.login_headers(client, "ct@t.com", PASSWORD, school.slug)
    teacher = await factories.user(db, school, "notdriver@t.com", "teacher")
    assert (await client.get(f"{API}/transport/vehicles", headers=t)).status_code == 403

    assert (await client.post(f"{API}/transport/vehicles", headers=m, json={"number": "pb01 ab 1234", "driver_id": str(teacher.id)})).status_code == 422
    v = (await client.post(f"{API}/transport/vehicles", headers=m, json={"number": "pb01 ab 1234", "capacity": 2, "driver_id": str(driver.id),
                                                                         "insurance_until": "2020-01-01"})).json()["data"]
    assert v["number"] == "PB01 AB 1234" and v["driver_name"] == "Drv" and v["expiring"] == ["Insurance"]
    assert (await client.post(f"{API}/transport/vehicles", headers=m, json={"number": "PB01 AB 1234"})).status_code == 422

    r = (await client.post(f"{API}/transport/routes", headers=m, json={"name": "Route 1 – Sector 21", "vehicle_id": v["id"], "monthly_fee": 1500,
        "stops": [{"name": "Sector 21 market", "lat": 30.73, "lng": 76.78, "pickup_time": "07:20", "drop_time": "14:10"},
                  {"name": "Rose Garden", "pickup_time": "07:30"}]})).json()["data"]
    assert [s["name"] for s in r["stops"]] == ["Sector 21 market", "Rose Garden"] and r["vehicle_number"] == "PB01 AB 1234"
    stop1, stop2 = r["stops"][0]["id"], r["stops"][1]["id"]
    assert (await client.put(f"{API}/transport/assignments", headers=m, json={"student_id": ids[0], "route_id": r["id"], "stop_id": "00000000-0000-0000-0000-000000000000"})).status_code == 422
    for i, stop in ((0, stop1), (1, stop2)):
        assert (await client.put(f"{API}/transport/assignments", headers=m, json={"student_id": ids[i], "route_id": r["id"], "stop_id": stop})).status_code == 200
    full = await client.put(f"{API}/transport/assignments", headers=m, json={"student_id": ids[2], "route_id": r["id"]})
    assert full.json()["error"]["code"] == "ROUTE_FULL"  # capacity 2

    # Editing stops keeps riders on stops whose name is unchanged.
    r2 = (await client.put(f"{API}/transport/routes/{r['id']}", headers=m, json={"name": "Route 1 – Sector 21", "vehicle_id": v["id"],
        "stops": [{"name": "Rose Garden"}, {"name": "Sector 21 market"}, {"name": "School gate"}]})).json()["data"]
    assert [s["name"] for s in r2["stops"]] == ["Rose Garden", "Sector 21 market", "School gate"] and r2["riders"] == 2
    riders = (await client.get(f"{API}/transport/routes/{r['id']}/riders", headers=m)).json()["data"]
    assert [(x["name"], x["stop_name"]) for x in riders] == [("Kid1 Sharma", "Rose Garden"), ("Kid0 Sharma", "Sector 21 market")]
    assert riders[1]["parent_phone"] == "+91 90000 00001"
    assert (await client.put(f"{API}/transport/assignments", headers=m, json={"student_id": ids[1], "route_id": None})).status_code == 200
    vehicles = (await client.get(f"{API}/transport/vehicles", headers=admin_headers)).json()["data"]
    assert vehicles[0]["riders"] == 1 and vehicles[0]["routes"] == ["Route 1 – Sector 21"]


async def test_trip_boarding_tracking_and_sos(client, db, school, admin_headers):
    section, ids, parent_pw, driver, tm = await _setup(client, db, school, admin_headers)
    v = (await client.post(f"{API}/transport/vehicles", headers=admin_headers, json={"number": "CH01 X 1", "driver_id": str(driver.id)})).json()["data"]
    r = (await client.post(f"{API}/transport/routes", headers=admin_headers, json={"name": "Route A", "vehicle_id": v["id"],
                                                                                    "stops": [{"name": "Stop 1"}]})).json()["data"]
    other = (await client.post(f"{API}/transport/routes", headers=admin_headers, json={"name": "Route B"})).json()["data"]
    await client.put(f"{API}/transport/assignments", headers=admin_headers, json={"student_id": ids[0], "route_id": r["id"], "stop_id": r["stops"][0]["id"]})
    await client.put(f"{API}/messaging/settings", headers=admin_headers, json={"events": {"transport": ["sms"]}})
    d = await factories.login_headers(client, "drv@t.com", PASSWORD, school.slug)
    p = await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)
    m = await factories.login_headers(client, "tm@t.com", PASSWORD, school.slug)

    today = (await client.get(f"{API}/transport/driver/today", headers=d)).json()["data"]
    assert today["vehicle"]["number"] == "CH01 X 1" and [x["name"] for x in today["routes"]] == ["Route A"] and today["running"] is None
    assert (await client.post(f"{API}/transport/trips", headers=d, json={"route_id": other["id"], "direction": "pickup"})).json()["error"]["code"] == "NOT_YOUR_ROUTE"
    assert (await client.post(f"{API}/transport/trips", headers=p, json={"route_id": r["id"], "direction": "pickup"})).status_code == 403
    trip = (await client.post(f"{API}/transport/trips", headers=d, json={"route_id": r["id"], "direction": "pickup"})).json()["data"]
    assert trip["status"] == "running" and trip["stale"] and [x["name"] for x in trip["roster"]] == ["Kid0 Sharma"]
    assert (await client.post(f"{API}/transport/trips", headers=d, json={"route_id": r["id"], "direction": "pickup"})).json()["error"]["code"] == "TRIP_RUNNING"

    assert (await client.post(f"{API}/transport/trips/{trip['id']}/ping", headers=d, json={"lat": 30.7333, "lng": 76.7794, "speed": 32})).status_code == 200
    assert (await client.post(f"{API}/transport/trips/{trip['id']}/ping", headers=d, json={"lat": 120, "lng": 0})).status_code == 422
    assert (await client.post(f"{API}/transport/trips/{trip['id']}/board", headers=d, json={"student_id": ids[0], "event": "dropped"})).json()["error"]["code"] == "NOT_BOARDED"
    assert (await client.post(f"{API}/transport/trips/{trip['id']}/board", headers=d, json={"student_id": ids[1], "event": "boarded"})).status_code == 422
    after = (await client.post(f"{API}/transport/trips/{trip['id']}/board", headers=d, json={"student_id": ids[0], "event": "boarded"})).json()["data"]
    assert after["on_board"] == 1 and after["roster"][0]["boarded_at"] and after["lat"] == 30.7333 and not after["stale"]

    # The parent sees the bus and was told the child boarded (app + SMS).
    mine = (await client.get(f"{API}/transport/my", headers=p)).json()["data"]
    assert mine[0]["route"]["name"] == "Route A" and mine[0]["stop"]["name"] == "Stop 1"
    assert mine[0]["trip"]["lat"] == 30.7333 and mine[0]["today"][0]["event"] == "boarded"
    bell = (await client.get(f"{API}/notifications", headers=p)).json()["data"]
    assert bell[0]["title"] == "Kid0 Sharma boarded the bus"
    sms = (await db.scalars(select(MessageLog).where(MessageLog.kind == "transport"))).all()
    assert len(sms) == 1 and sms[0].to == "+919000000001"

    live = (await client.get(f"{API}/transport/live", headers=m)).json()["data"]
    assert len(live) == 1 and live[0]["path"] == [[30.7333, 76.7794]]

    alert = (await client.post(f"{API}/transport/sos", headers=d, json={"message": "Tyre burst near Sector 22"})).json()["data"]
    assert alert["route_name"] == "Route A" and alert["lat"] == 30.7333
    office = (await client.get(f"{API}/notifications", headers=m)).json()["data"]
    assert office[0]["kind"] == "sos"
    resolved = (await client.post(f"{API}/transport/sos/{alert['id']}/resolve", headers=m, json={"resolution": "Spare bus sent"})).json()["data"]
    assert resolved["resolution"] == "Spare bus sent"

    ended = (await client.post(f"{API}/transport/trips/{trip['id']}/end", headers=d)).json()["data"]
    assert ended["status"] == "completed"
    assert (await client.post(f"{API}/transport/trips/{trip['id']}/ping", headers=d, json={"lat": 30, "lng": 76})).json()["error"]["code"] == "TRIP_ENDED"
    assert (await client.get(f"{API}/transport/live", headers=m)).json()["data"] == []
