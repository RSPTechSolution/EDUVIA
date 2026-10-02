import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_autosave_requires_auth():
    attempt_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(f"/api/v1/exams/attempts/{attempt_id}/autosave", json={"answers": {"q1": "A"}})
        # Since we have no auth token, it should be 401 Unauthorized
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_submit_requires_auth():
    attempt_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(f"/api/v1/exams/attempts/{attempt_id}/submit", json={"final_answers": {"q1": "A"}})
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_item_analysis_requires_auth():
    exam_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/exams/{exam_id}/analysis")
        assert res.status_code == 401
