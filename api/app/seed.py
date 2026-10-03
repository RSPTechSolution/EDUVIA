"""Development seed data. Safe to run repeatedly.

    python -m app.seed
"""
import asyncio
import random
from datetime import date

from sqlalchemy import select

from app.core.config import settings
from app.core.database import system_session
from app.core.permissions import MODULES, Role
from app.core.security import hash_password
from app.models import Plan, School, SchoolClass, SchoolModule, Section, Student, StudentGuardian, User

DEMO_PASSWORD = "Demo@1234"
SUPER_ADMIN = ("superadmin@eduvia.com", "Platform Admin", "Admin@1234")

DEMO_SCHOOL = dict(slug="demo", name="Green Valley Public School", city="Chandigarh", state="Punjab",
                   phone="+91 172 400 1234", email="office@greenvalley.edu", timezone="Asia/Kolkata",
                   currency="INR")

# (email, name, role, extra role-specific details)
DEMO_USERS = [
    ("admin@demo.com", "Anita Sharma", Role.SCHOOL_ADMIN, {"phone": "+91 98140 10001", "designation": "Administrator"}),
    ("principal@demo.com", "Dr. Rajesh Kumar", Role.PRINCIPAL, {"phone": "+91 98140 10002", "designation": "Principal"}),
    ("teacher@demo.com", "Priya Verma", Role.TEACHER, {"phone": "+91 98140 10003", "employee_id": "T-014", "designation": "Mathematics teacher"}),
    ("accounts@demo.com", "Vikram Singh", Role.ACCOUNTANT, {"phone": "+91 98140 10004", "employee_id": "A-002"}),
    ("reception@demo.com", "Neha Gupta", Role.RECEPTIONIST, {"phone": "+91 98140 10005", "employee_id": "R-001"}),
    ("parent@demo.com", "Suresh Patel", Role.PARENT, {"phone": "+91 98140 20001"}),
    ("student@demo.com", "Aarav Patel", Role.STUDENT, {}),
    ("driver@demo.com", "Harpreet Singh", Role.DRIVER, {"phone": "+91 98140 30001", "license_no": "PB01 2015 0042817"}),
]

CLASSES = ["Nursery", "LKG", "UKG"] + [f"Class {i}" for i in range(1, 11)]
FIRST = ["Aanya", "Vihaan", "Ishaan", "Saanvi", "Arjun", "Myra", "Kabir", "Anika", "Reyansh", "Kiara", "Advik", "Navya",
         "Atharv", "Pari", "Vivaan", "Ira", "Ayaan", "Sara", "Dhruv", "Meera", "Rohan", "Tara", "Krish", "Zoya"]
LAST = ["Sharma", "Verma", "Gupta", "Singh", "Mehta", "Kapoor", "Reddy", "Nair", "Iyer", "Joshi", "Malhotra", "Chopra"]


async def seed_academics(db, school) -> None:
    """Classes Nursery..Class 10 (sections A, B), ~40 students, and the Patel family."""
    if await db.scalar(select(SchoolClass.id).where(SchoolClass.school_id == school.id)):
        return
    sections: dict[str, list[Section]] = {}
    for i, name in enumerate(CLASSES):
        c = SchoolClass(school_id=school.id, name=name, sort_order=i + 1)
        db.add(c)
        await db.flush()
        sections[name] = [Section(school_id=school.id, class_id=c.id, name=n, capacity=40) for n in ("A", "B")]
        db.add_all(sections[name])
    await db.flush()
    teacher = await db.scalar(select(User).where(User.school_id == school.id, User.email == "teacher@demo.com"))
    sections["Class 5"][0].class_teacher_id = teacher.id

    rnd = random.Random(42)  # same demo data every time
    def add(first, last, gender, dob, cls, sec, n, roll):
        st = Student(school_id=school.id, admission_no=f"GV{2020 + n % 5}{n:03d}", first_name=first, last_name=last,
                     gender=gender, date_of_birth=dob, admission_date=date(2020 + n % 5, 4, 1),
                     class_id=sections[cls][sec].class_id, section_id=sections[cls][sec].id, roll_no=roll,
                     blood_group=rnd.choice(["A+", "B+", "O+", "AB+", "O-"]))
        db.add(st)
        return st

    aarav = add("Aarav", "Patel", "male", date(2015, 8, 21), "Class 5", 0, 1, 1)
    diya = add("Diya", "Patel", "female", date(2019, 1, 9), "Class 1", 1, 2, 1)
    n = 3
    for cls in CLASSES[3:]:
        for sec in (0, 1):
            for roll in range(2, 4):
                first = rnd.choice(FIRST)
                gender = "female" if first in ("Aanya", "Saanvi", "Myra", "Anika", "Kiara", "Navya", "Pari", "Ira", "Sara", "Meera", "Tara", "Zoya") else "male"
                age = CLASSES.index(cls) + 3
                add(first, rnd.choice(LAST), gender, date(2026 - age, rnd.randint(1, 12), rnd.randint(1, 28)), cls, sec, n, roll)
                n += 1
    await db.flush()

    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    aarav.user_id = users["student@demo.com"].id
    dad = users["parent@demo.com"]
    db.add_all([
        StudentGuardian(school_id=school.id, student_id=aarav.id, user_id=dad.id, relationship="father", is_primary=True),
        StudentGuardian(school_id=school.id, student_id=diya.id, user_id=dad.id, relationship="father", is_primary=True),
    ])


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

        existing = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
        pw = hash_password(DEMO_PASSWORD)
        for email, name, role, extra in DEMO_USERS:
            if email not in existing:
                db.add(User(school_id=school.id, email=email, full_name=name, role=role, password_hash=pw, **extra))
            else:  # fill details added since the account was created
                for k, v in extra.items():
                    if not getattr(existing[email], k):
                        setattr(existing[email], k, v)
        await db.flush()
        await seed_academics(db, school)

    print("Seed complete.")
    print(f"  Super admin : {SUPER_ADMIN[0]} / {SUPER_ADMIN[2]}  (no school ID)")
    print(f"  Demo school : school ID 'demo', password {DEMO_PASSWORD} for:")
    for email, _, role, _ in DEMO_USERS:
        print(f"    {role:<14} {email}")


if __name__ == "__main__":
    asyncio.run(seed())
