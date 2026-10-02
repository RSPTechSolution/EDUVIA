import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_get_tally_export_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/finance/export/tally?from_date=2024-10-01&to_date=2024-10-31")
        # Since we have no auth token, it should be 401 Unauthorized
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_pay_invoice_online():
    fake_invoice_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # It mocks razorpay response and doesn't require auth
        res = await client.post(f"/api/v1/finance/invoices/{fake_invoice_id}/pay-online?gateway=razorpay")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "order" in data["data"]
        assert "id" in data["data"]["order"]
