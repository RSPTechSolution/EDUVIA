import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from app.core.database import Base, engine, AsyncSessionLocal
from app.models.user import User
from app.models.school import School
from app.models.audit_log import AuditLog
from app.services.auth_service import hash_password

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # Create demo school
        school = await session.scalar(select(School).where(School.slug == "demo"))
        if not school:
            school = School(name="Demo School", slug="demo")
            session.add(school)
            await session.flush()
        
        # Create super admin
        admin = await session.scalar(select(User).where(User.email == "admin@demo.com"))
        if not admin:
            admin = User(
                email="admin@demo.com",
                password_hash=hash_password("admin123"),
                role="super_admin"
            )
            session.add(admin)
        
        # Create school admin
        school_admin = await session.scalar(select(User).where(User.email == "school@demo.com"))
        if not school_admin:
            school_admin = User(
                email="school@demo.com",
                password_hash=hash_password("School@123"),
                role="school_admin",
                school_id=school.id
            )
            session.add(school_admin)
            
        await session.commit()
        print("Seed completed.")

if __name__ == "__main__":
    asyncio.run(seed())
