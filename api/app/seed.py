"""Development seed data. Safe to run repeatedly.

    python -m app.seed
"""
import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.database import system_session
from app.core.permissions import MODULES, Role
from app.core.security import hash_password
from app.models import Plan, School, SchoolModule, User

DEMO_PASSWORD = "Demo@1234"
SUPER_ADMIN = ("superadmin@eduvia.com", "Platform Admin", "Admin@1234")

DEMO_SCHOOL = dict(slug="demo", name="Green Valley Public School", city="Chandigarh", state="Punjab",
                   phone="+91 172 400 1234", email="office@greenvalley.edu", timezone="Asia/Kolkata",
                   currency="INR")

DEMO_USERS = [
    ("admin@demo.com", "Anita Sharma", Role.SCHOOL_ADMIN),
    ("principal@demo.com", "Dr. Rajesh Kumar", Role.PRINCIPAL),
    ("teacher@demo.com", "Priya Verma", Role.TEACHER),
    ("accounts@demo.com", "Vikram Singh", Role.ACCOUNTANT),
    ("reception@demo.com", "Neha Gupta", Role.RECEPTIONIST),
    ("parent@demo.com", "Suresh Patel", Role.PARENT),
    ("student@demo.com", "Aarav Patel", Role.STUDENT),
    ("driver@demo.com", "Harpreet Singh", Role.DRIVER),
]


async def seed() -> None:
    if settings.ENVIRONMENT == "production":
        raise SystemExit("Refusing to seed demo data in production")
    async with system_session() as db:
        if not await db.scalar(select(User).where(User.email == SUPER_ADMIN[0], User.school_id.is_(None))):
            db.add(User(email=SUPER_ADMIN[0], full_name=SUPER_ADMIN[1], password_hash=hash_password(SUPER_ADMIN[2]),
                        role=Role.SUPER_ADMIN))

        # The demo school is on Max so every feature can be explored.
        max_plan = await db.scalar(select(Plan).where(Plan.code == "max"))
        school = await db.scalar(select(School).where(School.slug == DEMO_SCHOOL["slug"]))
        if not school:
            school = School(**DEMO_SCHOOL, plan=max_plan, subscription_status="active", billing_cycle="yearly")
            db.add(school)
            await db.flush()
        elif school.plan_id != max_plan.id:
            school.plan_id = max_plan.id
        existing_modules = set((await db.scalars(select(SchoolModule.module).where(SchoolModule.school_id == school.id))).all())
        for module in MODULES:
            if module not in existing_modules:
                db.add(SchoolModule(school_id=school.id, module=module, is_enabled=True))

        existing = set((await db.scalars(select(User.email).where(User.school_id == school.id))).all())
        pw = hash_password(DEMO_PASSWORD)
        for email, name, role in DEMO_USERS:
            if email not in existing:
                db.add(User(school_id=school.id, email=email, full_name=name, role=role, password_hash=pw))

    print("Seed complete.")
    print(f"  Super admin : {SUPER_ADMIN[0]} / {SUPER_ADMIN[2]}  (no school ID)")
    print(f"  Demo school : school ID 'demo', password {DEMO_PASSWORD} for:")
    for email, _, role in DEMO_USERS:
        print(f"    {role:<14} {email}")


if __name__ == "__main__":
    asyncio.run(seed())
