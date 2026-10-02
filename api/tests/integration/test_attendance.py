import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_adms_handshake_unauthorized_device():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/iclock/cdata?SN=UNKNOWN")
        assert res.status_code == 403

@pytest.mark.asyncio
async def test_bulk_attendance_mark_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        section_id = uuid.uuid4()
        res = await client.post(f"/api/v1/attendance/{section_id}", json={
            "date": "2024-10-15",
            "records": [{"student_id": str(uuid.uuid4()), "status": "present"}]
        })
        assert res.status_code == 401
