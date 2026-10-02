---
name: schoolerp-phase-13-saas-admin
description: >
  Phase 13 of SchoolERP (Python + Flutter) — SaaS Super Admin panel: school
  provisioning (single DB transaction), subscription plans with Razorpay/Stripe
  billing, custom domain DNS verification, per-school white-label branding,
  AES-256 encrypted backup to Cloudflare R2/Backblaze B2/Telegram, server health
  dashboard, global audit log. Use when building Super Admin, billing, or platform ops.
---
# Phase 13 — SaaS Super Admin & White-label
## Python FastAPI · Celery · Next.js

## SQLAlchemy Models

```python
# api/app/models/saas.py
class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))  # Basic, Pro, Enterprise
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    interval: Mapped[str] = mapped_column(String(20))  # monthly|yearly|onetime
    modules: Mapped[list] = mapped_column(ARRAY(String), default=[])  # module slugs
    max_students: Mapped[int | None] = mapped_column(nullable=True)
    max_staff: Mapped[int | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)

class SchoolSubscription(Base):
    __tablename__ = "school_subscriptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    gateway_sub_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SchoolBranding(Base):
    __tablename__ = "school_brandings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    primary_color: Mapped[str] = mapped_column(String(7), default="#1A3C5E")
    accent_color: Mapped[str] = mapped_column(String(7), default="#2E7D9E")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    font_family: Mapped[str] = mapped_column(String(100), default="Inter")
    custom_css: Mapped[str | None] = mapped_column(Text, nullable=True)
    firebase_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # encrypted at service level
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class BackupConfig(Base):
    __tablename__ = "backup_configs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(20))  # r2|b2|telegram
    credentials: Mapped[dict] = mapped_column(JSONB)   # AES-256 encrypted
    bucket_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(default=True)
    last_backup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_backup_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

class DomainMapping(Base):
    __tablename__ = "domain_mappings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    domain: Mapped[str] = mapped_column(String(200), unique=True)
    verification_token: Mapped[str] = mapped_column(String(100), unique=True)
    verified: Mapped[bool] = mapped_column(default=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

## School Provisioning (Single Transaction)

```python
# api/app/services/saas_service.py
from sqlalchemy.ext.asyncio import AsyncSession

async def provision_school(db: AsyncSession, data: ProvisionSchoolDTO) -> dict:
    """Creates school + admin user + modules + branding + subscription in one atomic transaction."""
    async with db.begin():
        # 1. Create school
        school = School(
            name=data.school_name,
            slug=_slugify(data.school_name),
            timezone=data.timezone,
            currency=data.currency,
            language=data.language,
        )
        db.add(school)
        await db.flush()  # get school.id

        # 2. Create school admin user
        temp_password = data.temp_password or secrets.token_urlsafe(12)
        admin_user = User(
            school_id=school.id,
            email=data.admin_email,
            password_hash=hash_password(temp_password),
            role="school_admin",
        )
        db.add(admin_user)

        # 3. Enable default modules
        default_modules = ["students", "academics", "attendance", "fees", "communication", "hr"]
        for module_slug in default_modules:
            db.add(SchoolModule(school_id=school.id, module=module_slug, is_enabled=True))

        # 4. Default branding
        db.add(SchoolBranding(school_id=school.id))

        # 5. Assign subscription plan
        if data.plan_id:
            plan = await db.get(Plan, data.plan_id)
            if not plan:
                raise NotFoundException("Plan not found")  # rolls back entire transaction
            db.add(SchoolSubscription(
                school_id=school.id,
                plan_id=plan.id,
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=365 if plan.interval == "yearly" else 30),
                status="active",
            ))

        # 6. Queue welcome email (outside transaction)
        await db.flush()

    # Transaction committed. Now send welcome email via Celery.
    send_welcome_email.delay(str(school.id), data.admin_email, temp_password)

    return {"school": school, "admin_email": data.admin_email, "temp_password": temp_password}

def _slugify(name: str) -> str:
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return slug[:50]
```

## Backup Service (AES-256 + Adapters)

```python
# api/app/services/backup_service.py
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import base64, os, aioboto3, httpx

def encrypt_credentials(data: dict, key: bytes) -> dict:
    f = Fernet(base64.urlsafe_b64encode(key[:32]))
    import json
    return {"encrypted": f.encrypt(json.dumps(data).encode()).decode(), "version": 1}

def decrypt_credentials(encrypted_data: dict, key: bytes) -> dict:
    f = Fernet(base64.urlsafe_b64encode(key[:32]))
    import json
    return json.loads(f.decrypt(encrypted_data["encrypted"].encode()))

class BackupAdapter:
    async def upload(self, data: bytes, filename: str) -> str:
        raise NotImplementedError

class CloudflareR2Adapter(BackupAdapter):
    def __init__(self, account_id: str, access_key: str, secret_key: str, bucket: str):
        self.endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket = bucket

    async def upload(self, data: bytes, filename: str) -> str:
        session = aioboto3.Session()
        async with session.client('s3',
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
        ) as s3:
            await s3.put_object(Bucket=self.bucket, Key=filename, Body=data)
        return f"{self.endpoint}/{self.bucket}/{filename}"

class BackblazeB2Adapter(BackupAdapter):
    def __init__(self, key_id: str, application_key: str, bucket_id: str):
        self.key_id = key_id
        self.application_key = application_key
        self.bucket_id = bucket_id

    async def upload(self, data: bytes, filename: str) -> str:
        # B2 native API upload
        async with httpx.AsyncClient() as client:
            auth = await client.get("https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
                                     auth=(self.key_id, self.application_key))
            auth_data = auth.json()
            upload_url = await client.post(f"{auth_data['apiUrl']}/b2api/v2/b2_get_upload_url",
                                            json={"bucketId": self.bucket_id},
                                            headers={"Authorization": auth_data["authorizationToken"]})
            upload_info = upload_url.json()
            import hashlib
            sha1 = hashlib.sha1(data).hexdigest()
            await client.post(upload_info["uploadUrl"], content=data,
                headers={"Authorization": upload_info["authorizationToken"],
                         "X-Bz-File-Name": filename, "Content-Type": "application/octet-stream",
                         "X-Bz-Content-Sha1": sha1})
        return f"b2://{self.bucket_id}/{filename}"

class TelegramAdapter(BackupAdapter):
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id

    async def upload(self, data: bytes, filename: str) -> str:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendDocument",
                data={"chat_id": self.chat_id, "caption": f"SchoolERP Backup: {filename}"},
                files={"document": (filename, data, "application/octet-stream")},
            )
        return f"telegram://{self.chat_id}/{filename}"

# Celery task — daily backup per school
@shared_task
def run_school_backup(school_id: str):
    import asyncio
    asyncio.run(_run_backup(school_id))

async def _run_backup(school_id: str):
    async with AsyncSessionLocal() as db:
        config = await db.scalar(select(BackupConfig).where(
            BackupConfig.school_id == uuid.UUID(school_id), BackupConfig.is_enabled == True
        ))
        if not config:
            return

        # Decrypt credentials using master key from env
        master_key = settings.BACKUP_MASTER_KEY.encode()[:32]
        creds = decrypt_credentials(config.credentials, master_key)

        # Dump school data (pg_dump filtered by school_id via COPY)
        import subprocess, io
        dump = subprocess.check_output([
            "pg_dump", settings.DATABASE_URL.replace("+asyncpg", ""),
            "--schema-qualified", f"--where=school_id='{school_id}'"
        ])

        # Encrypt the dump
        key = base64.urlsafe_b64encode(master_key)
        encrypted = Fernet(key).encrypt(dump)

        filename = f"backup-{school_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.enc"

        # Upload to configured provider
        adapter = {
            "r2": lambda: CloudflareR2Adapter(creds["account_id"], creds["access_key"], creds["secret_key"], config.bucket_name),
            "b2": lambda: BackblazeB2Adapter(creds["key_id"], creds["application_key"], creds["bucket_id"]),
            "telegram": lambda: TelegramAdapter(creds["bot_token"], creds["chat_id"]),
        }[config.provider]()
        url = await adapter.upload(encrypted, filename)

        config.last_backup_at = datetime.utcnow()
        config.last_backup_status = "success"
        await db.commit()
```

## DNS Domain Verification

```python
# api/app/services/domain_service.py
import dns.resolver
import secrets

async def create_domain_mapping(db: AsyncSession, school_id: uuid.UUID, domain: str) -> DomainMapping:
    token = f"schoolerp-verify={secrets.token_hex(16)}"
    mapping = DomainMapping(school_id=school_id, domain=domain, verification_token=token)
    db.add(mapping)
    await db.commit()
    return mapping

async def verify_domain(db: AsyncSession, mapping_id: uuid.UUID) -> bool:
    mapping = await db.get(DomainMapping, mapping_id)
    if not mapping or mapping.verified:
        return mapping.verified if mapping else False
    try:
        answers = dns.resolver.resolve(mapping.domain, 'TXT')
        for rdata in answers:
            for txt_string in rdata.strings:
                if mapping.verification_token in txt_string.decode():
                    mapping.verified = True
                    mapping.verified_at = datetime.utcnow()
                    await db.commit()
                    return True
    except Exception:
        pass
    return False
```

## Next.js Super Admin Panel

```typescript
// web/src/app/super-admin/(dashboard)/page.tsx
// Stats: total schools, total students, MRR, ARR
// School list: name, plan, students, staff, last active, status
// Revenue chart: Recharts LineChart (monthly MRR)
// Plan distribution: Recharts PieChart
// Quick actions: Provision School, Change Plan, Suspend

// web/src/app/super-admin/(dashboard)/schools/page.tsx
// Full TanStack Table of all schools
// Search, filter by plan/status
// Actions: manage, branding, modules, backup config, domain
```

## Testing — Phase 13

```python
@pytest.mark.asyncio
async def test_provision_creates_all_in_one_transaction(db):
    data = ProvisionSchoolDTO(
        school_name="Test Academy", admin_email="admin@test.com",
        plan_id=str(BASIC_PLAN_ID), timezone="Asia/Kolkata", currency="INR", language="en"
    )
    result = await provision_school(db, data)
    assert result["school"].id is not None

    # Admin user created
    user = await db.scalar(select(User).where(User.email == "admin@test.com"))
    assert user is not None
    assert user.role == "school_admin"

    # Default modules enabled
    modules = await db.scalars(select(SchoolModule).where(
        SchoolModule.school_id == result["school"].id, SchoolModule.is_enabled == True))
    assert len(list(modules.all())) >= 5

    # Branding created
    branding = await db.scalar(select(SchoolBranding).where(SchoolBranding.school_id == result["school"].id))
    assert branding is not None

@pytest.mark.asyncio
async def test_provision_rolls_back_on_invalid_plan(db):
    data = ProvisionSchoolDTO(
        school_name="Rollback School", admin_email="admin@rollback.com",
        plan_id="00000000-0000-0000-0000-000000000000",  # non-existent
        timezone="Asia/Kolkata", currency="INR", language="en"
    )
    with pytest.raises(NotFoundException):
        await provision_school(db, data)

    # School should NOT exist
    school = await db.scalar(select(School).where(School.name == "Rollback School"))
    assert school is None

@pytest.mark.asyncio
async def test_backup_encrypts_before_upload(monkeypatch):
    uploads = []
    async def mock_upload(self, data: bytes, filename: str) -> str:
        uploads.append(data)
        return f"mock://{filename}"

    monkeypatch.setattr(CloudflareR2Adapter, "upload", mock_upload)
    await _run_backup(str(SCHOOL_ID))
    assert len(uploads) == 1
    # Encrypted data should NOT be plain SQL
    assert b"CREATE TABLE" not in uploads[0]
    assert b"INSERT INTO" not in uploads[0]

@pytest.mark.asyncio
async def test_domain_verification_checks_dns_txt(monkeypatch):
    mapping = await create_domain_mapping(db, SCHOOL_ID, "erp.testschool.com")

    # Mock DNS resolution to return the verification token
    class MockAnswer:
        strings = [mapping.verification_token.encode()]
    monkeypatch.setattr(dns.resolver, "resolve", lambda *a, **kw: [MockAnswer()])

    verified = await verify_domain(db, mapping.id)
    assert verified is True
```

## Antigravity Prompt for Phase 13

```
@file skills/master-plan/SKILL.md
@file skills/phase-13-saas-admin/SKILL.md

Build Phase 13 — SaaS Super Admin:
1. All SQLAlchemy models (Plan, SchoolSubscription, SchoolBranding, BackupConfig,
   DomainMapping) + Alembic migration
2. School provisioning: single async transaction (school + user + modules + branding + plan),
   Celery task for welcome email, rollback on any error
3. Plan management API: CRUD, module bundling per plan
4. Razorpay subscription billing integration (create subscription, webhook handler)
5. DNS domain verification: generate TXT token, dns.resolver check
6. White-label branding API: color/logo/font per school + CSS variable injection in Next.js
7. Backup system: encrypt (Fernet AES-256) + adapters for Cloudflare R2, Backblaze B2,
   Telegram Bot; Celery beat daily at 2am per school timezone
8. Server health endpoint: Redis queue depth, DB pool status, disk usage, cron status
9. Next.js Super Admin dashboard: stats bar, school list TanStack Table, MRR Recharts chart
10. Next.js provisioning wizard: multi-step form (school info → plan → confirm)
11. All tests: pytest (provision transaction, rollback, backup encryption, DNS mock) + playwright E2E
```
