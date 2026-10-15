import pytest

pytestmark = pytest.mark.asyncio


async def test_preferences_saved_and_merged(client, admin_headers):
    r = await client.get("/api/v1/users/me/preferences", headers=admin_headers)
    assert r.status_code == 200
    layout = {"order": ["stats", "charts"], "hidden": ["activity"]}
    r = await client.put("/api/v1/users/me/preferences", json={"dashboard": layout}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["data"]["dashboard"] == layout
    r = await client.put("/api/v1/users/me/preferences", json={"other": 1}, headers=admin_headers)
    assert r.json()["data"] == {**r.json()["data"], "dashboard": layout, "other": 1}
    r = await client.get("/api/v1/users/me/preferences", headers=admin_headers)
    assert r.json()["data"]["dashboard"] == layout


async def test_preferences_need_sign_in_and_stay_small(client, admin_headers):
    assert (await client.get("/api/v1/users/me/preferences")).status_code == 401
    r = await client.put("/api/v1/users/me/preferences", json={f"k{i}": i for i in range(30)}, headers=admin_headers)
    assert r.status_code == 422
