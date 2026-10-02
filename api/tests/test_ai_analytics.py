import pytest
import uuid
from app.services.ai.intent_classifier import classify_intent
from app.services.ai.query_templates import execute_intent
from app.models.user import User

@pytest.mark.asyncio
async def test_intent_classifier_fee_outstanding():
    # Calling the mock in intent_classifier.py
    result = await classify_intent("Which students have pending fees above 3000?", provider="openai")
    assert result.intent == "fee.outstanding"
    assert result.params.get("min_amount") == 3000

@pytest.mark.asyncio
async def test_execute_intent_respects_role_permissions():
    class MockDb:
        pass
    db = MockDb()
    school_id = uuid.uuid4()
    
    result = await execute_intent(db, "fee.defaulters", {}, school_id, user_role="teacher")
    assert "error" in result
    assert "permission" in result["error"].lower()

@pytest.mark.asyncio
async def test_execute_intent_never_uses_raw_sql(monkeypatch):
    """Ensure raw SQL is never executed regardless of LLM output"""
    class MockDb:
        async def scalars(self, stmt):
            class MockResult:
                def all(self): return []
            return MockResult()

    db = MockDb()
    school_id = uuid.uuid4()

    raw_calls = []
    original_scalars = db.scalars
    async def patched_scalars(stmt, *args, **kwargs):
        if isinstance(stmt, str):
            raw_calls.append(stmt)
        return await original_scalars(stmt, *args, **kwargs)
        
    monkeypatch.setattr(db, "scalars", patched_scalars)

    await execute_intent(db, "fee.outstanding", {}, school_id, "accountant")
    assert len(raw_calls) == 0, "Raw SQL strings were executed!"

from app.routers.ai_analytics import dashboard_analytics

@pytest.mark.asyncio
async def test_dashboard_analytics_returns_30_day_trend():
    class MockResult:
        def __init__(self, items):
            self.items = items
        def __iter__(self):
            return iter(self.items)
            
    class MockDb:
        async def execute(self, stmt):
            return MockResult([])

    class MockUser:
        school_id = uuid.uuid4()

    db = MockDb()
    user = MockUser()
    
    res = await dashboard_analytics(db=db, current_user=user)
    assert res["status"] == "success"
    data = res["data"]
    assert "attendance_trend" in data
    assert "fee_trend" in data
    assert len(data["attendance_trend"]) <= 30
