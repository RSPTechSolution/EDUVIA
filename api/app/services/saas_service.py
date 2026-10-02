import uuid
import secrets
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.saas import Plan, SchoolSubscription, SchoolBranding
from app.models.school import School
from app.models.user import User
from fastapi import HTTPException

def get_password_hash(password: str) -> str:
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()

class NotFoundException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=404, detail=detail)

class ProvisionSchoolDTO:
    def __init__(self, school_name, admin_email, plan_id, timezone, currency, language, temp_password=None):
        self.school_name = school_name
        self.admin_email = admin_email
        self.plan_id = plan_id
        self.timezone = timezone
        self.currency = currency
        self.language = language
        self.temp_password = temp_password

async def provision_school(db: AsyncSession, data: ProvisionSchoolDTO) -> dict:
    # 1. Create school
    school = School(
        id=uuid.uuid4(),
        name=data.school_name,
        slug=_slugify(data.school_name),
        timezone=data.timezone,
        currency=data.currency,
        language=data.language,
    )
    db.add(school)

    # 2. Create school admin user
    temp_password = data.temp_password or secrets.token_urlsafe(12)
    admin_user = User(
        id=uuid.uuid4(),
        school_id=school.id,
        email=data.admin_email,
        password_hash=get_password_hash(temp_password),
        role="school_admin",
    )
    db.add(admin_user)

    # 3. Default branding
    branding = SchoolBranding(id=uuid.uuid4(), school_id=school.id)
    db.add(branding)

    # 4. Assign subscription plan
    if data.plan_id:
        try:
            plan_uuid = uuid.UUID(data.plan_id)
        except ValueError:
            raise NotFoundException("Invalid Plan ID")

        plan = await db.get(Plan, plan_uuid)
        if not plan:
            raise NotFoundException("Plan not found")

        db.add(SchoolSubscription(
            id=uuid.uuid4(),
            school_id=school.id,
            plan_id=plan.id,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=365 if plan.interval == "yearly" else 30),
            status="active",
        ))

    await db.commit()

    return {"school": school, "admin_email": data.admin_email, "temp_password": temp_password}

def _slugify(name: str) -> str:
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return slug[:50]
