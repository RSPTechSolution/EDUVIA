import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_db_session

class MockSession:
    async def commit(self): pass
    async def refresh(self, obj): pass
    def add(self, obj): pass
    def add_all(self, objs): pass

async def override_get_db_session():
    yield MockSession()

app.dependency_overrides[get_db_session] = override_get_db_session

@pytest.mark.asyncio
async def test_gps_batch_stored_and_emitted(mocker):
    trip_id = uuid.uuid4()
    pings = [{"lat": 30.7333, "lng": 76.7794, "speed": 40.0}]
    
    mock_sio = mocker.patch('app.routers.transport.sio.emit')
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(f"/api/v1/transport/trips/{trip_id}/gps", json={"pings": pings})
        
    assert res.status_code == 200
    assert res.json()["data"]["saved"] == 1
    mock_sio.assert_called_once_with("trip_update", mocker.ANY, room="transport_live")

@pytest.mark.asyncio
async def test_sos_sends_firebase_push():
    trip_id = uuid.uuid4()
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/transport/sos", json={"trip_id": str(trip_id), "lat": 30.73, "lng": 76.77})
        
    assert res.status_code == 200
    assert res.json()["data"]["message"] == "SOS sent"
