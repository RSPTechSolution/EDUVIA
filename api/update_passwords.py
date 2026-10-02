import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def update_passwords():
    correct_hash = pwd_context.hash('password123')
    print(f"New hash: {correct_hash}")
    
    async with AsyncSessionLocal() as session:
        await session.execute(
            text("UPDATE users SET password_hash = :hash"),
            {"hash": correct_hash}
        )
        await session.commit()
        print("Updated all users to 'password123'")

if __name__ == "__main__":
    asyncio.run(update_passwords())
