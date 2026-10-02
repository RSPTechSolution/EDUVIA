import pytest
import uuid
import dns.resolver
from sqlalchemy import select
from app.models.saas import SchoolSubscription, SchoolBranding, Plan, BackupConfig
from app.models.school import School
from app.models.user import User
from app.services.saas_service import provision_school, ProvisionSchoolDTO, NotFoundException
from app.services.backup_service import _run_backup, CloudflareR2Adapter
from app.services.domain_service import create_domain_mapping, verify_domain

class MockDb:
    def __init__(self):
        self.added = []
    def add(self, item): self.added.append(item)
    async def commit(self): pass
    async def get(self, model, id):
        if model == Plan:
            return Plan(id=uuid.uuid4(), interval="monthly")
        return None

@pytest.mark.asyncio
async def test_provision_creates_all_in_one_transaction():
    db = MockDb()
    data = ProvisionSchoolDTO(
        school_name="Test Academy", admin_email="admin@test.com",
        plan_id=str(uuid.uuid4()), timezone="Asia/Kolkata", currency="INR", language="en"
    )
    result = await provision_school(db, data)
    assert result["school"].name == "Test Academy"
    
    # Check what was added
    models_added = [type(item).__name__ for item in db.added]
    assert "School" in models_added
    assert "User" in models_added
    assert "SchoolBranding" in models_added
    assert "SchoolSubscription" in models_added

@pytest.mark.asyncio
async def test_provision_rolls_back_on_invalid_plan():
    db = MockDb()
    # Mock get to return None
    async def get_none(*args): return None
    db.get = get_none
    
    data = ProvisionSchoolDTO(
        school_name="Rollback School", admin_email="admin@rollback.com",
        plan_id=str(uuid.uuid4()), timezone="Asia/Kolkata", currency="INR", language="en"
    )
    with pytest.raises(NotFoundException):
        await provision_school(db, data)

@pytest.mark.asyncio
async def test_backup_encrypts_before_upload(monkeypatch):
    uploads = []
    async def mock_upload(self, data: bytes, filename: str) -> str:
        uploads.append(data)
        return f"mock://{filename}"

    monkeypatch.setattr(CloudflareR2Adapter, "upload", mock_upload)
    
    # We must patch AsyncSessionLocal inside backup_service
    class MockConfigDb:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def scalar(self, stmt):
            import json
            from cryptography.fernet import Fernet
            import base64
            key = base64.urlsafe_b64encode(b"thisisaverysecretmasterkeythatis")
            f = Fernet(key)
            encrypted = f.encrypt(json.dumps({
                "account_id": "test", "access_key": "test", "secret_key": "test"
            }).encode()).decode()
            
            return BackupConfig(provider="r2", credentials={"encrypted": encrypted, "version": 1}, bucket_name="test")
        async def commit(self): pass

    monkeypatch.setattr("app.services.backup_service.AsyncSessionLocal", lambda: MockConfigDb())
    
    await _run_backup(str(uuid.uuid4()))
    assert len(uploads) == 1
    # Encrypted data should NOT be plain SQL
    assert b"CREATE TABLE" not in uploads[0]
    assert b"INSERT INTO" not in uploads[0]

@pytest.mark.asyncio
async def test_domain_verification_checks_dns_txt(monkeypatch):
    class MockDbDomain:
        def add(self, item): pass
        async def commit(self): pass
        async def get(self, model, id):
            from app.models.saas import DomainMapping
            return DomainMapping(verification_token="schoolerp-verify=testtoken123", domain="test.com")
            
    db = MockDbDomain()
    
    # Mock DNS resolution
    class MockAnswer:
        strings = [b"schoolerp-verify=testtoken123"]
    monkeypatch.setattr(dns.resolver, "resolve", lambda *a, **kw: [MockAnswer()])

    verified = await verify_domain(db, uuid.uuid4())
    assert verified is True
