from cryptography.fernet import Fernet
import base64
import json
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.saas import BackupConfig
from app.core.database import AsyncSessionLocal
import uuid

def encrypt_credentials(data: dict, key: bytes) -> dict:
    f = Fernet(base64.urlsafe_b64encode(key[:32]))
    return {"encrypted": f.encrypt(json.dumps(data).encode()).decode(), "version": 1}

def decrypt_credentials(encrypted_data: dict, key: bytes) -> dict:
    f = Fernet(base64.urlsafe_b64encode(key[:32]))
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
        return f"{self.endpoint}/{self.bucket}/{filename}"

async def _run_backup(school_id: str):
    async with AsyncSessionLocal() as db:
        config = await db.scalar(select(BackupConfig).where(
            BackupConfig.school_id == uuid.UUID(school_id), BackupConfig.is_enabled == True
        ))
        if not config:
            return

        master_key = b"thisisaverysecretmasterkeythatis" # 32 bytes mock key
        creds = decrypt_credentials(config.credentials, master_key)

        dump = b"mock pg_dump data"
        key = base64.urlsafe_b64encode(master_key)
        encrypted = Fernet(key).encrypt(dump)

        filename = f"backup-{school_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.enc"

        if config.provider == "r2":
            adapter = CloudflareR2Adapter(creds["account_id"], creds["access_key"], creds["secret_key"], config.bucket_name)
            await adapter.upload(encrypted, filename)

        config.last_backup_at = datetime.utcnow()
        config.last_backup_status = "success"
        await db.commit()
