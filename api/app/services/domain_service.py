import dns.resolver
import secrets
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.saas import DomainMapping

async def create_domain_mapping(db: AsyncSession, school_id: uuid.UUID, domain: str) -> DomainMapping:
    token = f"schoolerp-verify={secrets.token_hex(16)}"
    mapping = DomainMapping(id=uuid.uuid4(), school_id=school_id, domain=domain, verification_token=token)
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
