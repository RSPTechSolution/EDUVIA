"""Create the platform's super admin (or reset their password) on a new server.

    python -m app.create_super_admin --email you@example.in --name "Your Name"
    python -m app.create_super_admin --email you@example.in --reset

Prints a temporary password; the account must choose its own at the first sign-in (without a school ID)."""
import argparse
import asyncio
import secrets
import sys

from sqlalchemy import select

from app.core.database import system_session
from app.core.permissions import Role
from app.core.security import hash_password
from app.models import User


async def run(email: str, name: str | None, reset: bool) -> str:
    password = secrets.token_urlsafe(12)
    async with system_session() as db:
        user = await db.scalar(select(User).where(User.email == email, User.school_id.is_(None)))
        if user and not reset:
            sys.exit(f"{email} already exists. Use --reset to give it a new temporary password.")
        if not user and reset:
            sys.exit(f"No platform admin called {email}.")
        if not user:
            if not name:
                sys.exit("Give a --name for the new account.")
            user = User(school_id=None, email=email, full_name=name, role=Role.SUPER_ADMIN, is_active=True, password_hash="")
            db.add(user)
        user.password_hash = hash_password(password)
        user.must_change_password = True
        user.is_active = True
        await db.commit()
    return password


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--email", required=True)
    p.add_argument("--name")
    p.add_argument("--reset", action="store_true", help="give an existing platform admin a new temporary password")
    a = p.parse_args()
    password = asyncio.run(run(a.email.strip().lower(), a.name, a.reset))
    print(f"Platform admin {a.email}: temporary password {password}")
    print("Sign in without a school ID; you'll be asked to choose a new password.")


if __name__ == "__main__":
    main()
