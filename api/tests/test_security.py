import pytest
import uuid
from datetime import datetime, timedelta
from app.services.gate_pass_service import approve_gate_pass, scan_gate_pass_qr, BadRequestException
from app.services.cctv_service import can_parent_view_camera
from app.models.security import GatePass, GateLog, CctvCamera, CctvConsent
from app.models.user import User
from app.models.school import School
from app.models.user import User

class MockSession:
    def __init__(self, obj=None, count=0):
        self.obj = obj
        self.count = count
        self.added = []

    async def get(self, model, id):
        if model == User and self.obj and hasattr(self.obj, 'is_active'):
            return self.obj
        return self.obj

    async def scalar(self, stmt):
        if 'count' in str(stmt):
            return self.count
        return self.obj
        
    def add(self, obj):
        self.added.append(obj)
        
    async def commit(self): pass

@pytest.mark.asyncio
async def test_approve_generates_qr_token():
    gp = GatePass(id=uuid.uuid4(), status="pending", pass_type="student_exit")
    db = MockSession(obj=gp)
    
    approved_by = uuid.uuid4()
    result = await approve_gate_pass(db, gp.id, approved_by)
    
    assert result.status == "approved"
    assert result.qr_token is not None
    assert result.approved_by == approved_by

@pytest.mark.asyncio
async def test_scan_used_pass_rejected():
    gp = GatePass(id=uuid.uuid4(), status="approved", used_at=datetime.utcnow())
    db = MockSession(obj=gp)
    
    res = await scan_gate_pass_qr(db, "fake_token", uuid.uuid4())
    assert res["status"] == "rejected"
    assert "already used" in res["message"]

@pytest.mark.asyncio
async def test_cctv_denied_without_all_5_gates():
    # count=4 means not all 5 consents granted
    mock_camera = CctvCamera(id=uuid.uuid4(), section_id=uuid.UUID(int=1))
    db = MockSession(obj=mock_camera, count=4)
    
    can_view, reason = await can_parent_view_camera(db, None, uuid.uuid4(), mock_camera.id, uuid.uuid4())
    assert can_view is False
    assert "Consent not fully granted" in reason

@pytest.mark.asyncio
async def test_cctv_allowed_with_all_5_gates():
    mock_camera = CctvCamera(id=uuid.uuid4(), section_id=uuid.UUID(int=1))
    class MockUser:
        is_active = True
    db = MockSession(obj=mock_camera, count=5)
    
    # Needs to get User later, so we just monkey patch it
    async def mock_get(model, id):
        if model == User:
            return MockUser()
        return mock_camera
    db.get = mock_get

    can_view, reason = await can_parent_view_camera(db, None, uuid.uuid4(), mock_camera.id, uuid.uuid4())
    assert can_view is True
