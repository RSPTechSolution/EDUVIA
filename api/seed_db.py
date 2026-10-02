import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.services.auth_service import hash_password

# Import all models to ensure they are available
from app.models.user import User
from app.models.school import School, AcademicYear
from app.models.academics import Class, Section, Student
from app.models.finance import FeeCategory, FeeStructure, FeeInvoice
from app.models.library import Book, BookCopy
from app.models.transport import Route, RouteStop

async def seed_data():
    async with AsyncSessionLocal() as session:
        print("Starting comprehensive data seed...")
        
        # Clear existing data
        await session.execute(text("TRUNCATE TABLE users, schools, academic_years, classes, sections, students, fee_categories, fee_structures, fee_invoices, books, book_copies, routes, route_stops CASCADE;"))
        
        pw_hash = hash_password("password123")
        now = datetime.now(timezone.utc)
        
        # 1. Super Admin
        super_admin = User(
            id=uuid.uuid4(),
            email="superadmin@eduvia.com",
            password_hash=pw_hash,
            role="SUPERADMIN",
            is_active=True
        )
        session.add(super_admin)
        
        school_configs = [
            {"name": "Global Excellence Public School", "slug": "geps", "domain": "geps.edu", "prefix": "geps"},
            {"name": "Sunrise International Academy", "slug": "sia", "domain": "sia.edu", "prefix": "sia"}
        ]
        
        schools = []
        for s_conf in school_configs:
            # 2. Schools
            school = School(
                id=uuid.uuid4(),
                name=s_conf["name"],
                slug=s_conf["slug"],
                domain=s_conf["domain"],
                is_active=True,
                plan="premium",
                timezone="Asia/Kolkata",
                currency="INR",
                language="en"
            )
            session.add(school)
            schools.append((school, s_conf["prefix"]))
            
        await session.flush()
        
        for school, prefix in schools:
            # 3. Staff for each school
            # School Head (ADMIN)
            school_admin = User(id=uuid.uuid4(), school_id=school.id, email=f"admin@{prefix}.edu", password_hash=pw_hash, role="ADMIN")
            # Accountant
            accountant = User(id=uuid.uuid4(), school_id=school.id, email=f"accountant@{prefix}.edu", password_hash=pw_hash, role="ACCOUNTANT")
            # Teacher
            teacher = User(id=uuid.uuid4(), school_id=school.id, email=f"teacher@{prefix}.edu", password_hash=pw_hash, role="TEACHER")
            
            session.add_all([school_admin, accountant, teacher])
            
            # 4. Academics setup (Classes and Sections)
            class_10 = Class(id=uuid.uuid4(), school_id=school.id, name="Class 10", order=10)
            session.add(class_10)
            await session.flush()
            
            section_A = Section(id=uuid.uuid4(), school_id=school.id, class_id=class_10.id, name="A")
            section_B = Section(id=uuid.uuid4(), school_id=school.id, class_id=class_10.id, name="B")
            session.add_all([section_A, section_B])
            await session.flush()
            
            sections = [section_A, section_B]
            
            # 5. Students (200 per school)
            students = []
            for i in range(1, 201):
                sec = random.choice(sections)
                student = Student(
                    id=uuid.uuid4(),
                    school_id=school.id,
                    section_id=sec.id,
                    admission_no=f"ADM-{prefix.upper()}-{1000+i}",
                    first_name=f"Student{i}",
                    last_name=f"Of{prefix.capitalize()}",
                    gender=random.choice(["Male", "Female"]),
                    status="active"
                )
                session.add(student)
                students.append(student)
                
                # Also create a login for the first student of each school
                if i == 1:
                    student_user = User(
                        id=uuid.uuid4(), school_id=school.id, email=f"student@{prefix}.edu", password_hash=pw_hash, role="STUDENT"
                    )
                    session.add(student_user)
            
            await session.flush()
            
            # 6. Academic Year & Finance
            ay = AcademicYear(id=uuid.uuid4(), school_id=school.id, name="2023-2024", start_date=now.date(), end_date=(now + timedelta(days=365)).date())
            session.add(ay)
            await session.flush()
            
            fee_cat = FeeCategory(id=uuid.uuid4(), school_id=school.id, name="Tuition Fee")
            session.add(fee_cat)
            await session.flush()
            
            fee_struct = FeeStructure(
                id=uuid.uuid4(), school_id=school.id, academic_year_id=ay.id, class_id=class_10.id, fee_category_id=fee_cat.id, amount=15000.00
            )
            session.add(fee_struct)
            
            # Assign fee invoices to some students
            for student in students[:10]:
                inv = FeeInvoice(
                    id=uuid.uuid4(), school_id=school.id, student_id=student.id, academic_year_id=ay.id,
                    invoice_no=f"INV-{student.admission_no}", total_amount=15000.00, paid_amount=0, status="unpaid",
                    due_date=now + timedelta(days=30)
                )
                session.add(inv)
                
            # 7. Library Books
            book = Book(id=uuid.uuid4(), school_id=school.id, title="Physics Fundamentals", author="H.C. Verma", category="Science")
            session.add(book)
            await session.flush()
            
            for i in range(5):
                copy = BookCopy(id=uuid.uuid4(), book_id=book.id, barcode=f"LIB-{prefix.upper()}-{100+i}", is_available=True)
                session.add(copy)
                
            # 8. Transport Routes
            route = Route(id=uuid.uuid4(), school_id=school.id, name="Route 1 (Downtown)")
            session.add(route)
            await session.flush()
            
            stop = RouteStop(id=uuid.uuid4(), route_id=route.id, name="City Center", latitude=0, longitude=0, order_index=1, expected_time="07:30")
            session.add(stop)
            
        await session.commit()
        print("Seed completed successfully!")
        
        print("\n--- CREDENTIALS (All Passwords are 'password123') ---")
        print("Super Admin:")
        print(" - superadmin@eduvia.com")
        for s, p in schools:
            print(f"\nSchool: {s.name}")
            print(f" - Admin: admin@{p}.edu")
            print(f" - Accountant: accountant@{p}.edu")
            print(f" - Teacher: teacher@{p}.edu")
            print(f" - Student: student@{p}.edu")

if __name__ == "__main__":
    asyncio.run(seed_data())
