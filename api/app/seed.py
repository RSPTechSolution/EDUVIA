"""Development seed data: a realistic school to explore every role with.

    python -m app.seed            # create what's missing
    python -m app.seed --reset    # wipe the demo school and build it again

Everything is generated from a fixed random seed, so the data is the same on every machine.
"""
import asyncio
import random
import sys
from collections import Counter, defaultdict
from datetime import date, time

from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import system_session
from app.core.permissions import MODULES, Role
from app.core.security import hash_password
from app.models import (
    Period, Plan, School, SchoolClass, SchoolModule, Section, Student, StudentGuardian, Subject, TeacherSubject,
    TeacherUnavailability, TimetableEntry, User,
)

DEMO_PASSWORD = "Demo@1234"
SUPER_ADMIN = ("superadmin@eduvia.com", "Platform Admin", "Admin@1234")

DEMO_SCHOOL = dict(slug="demo", name="Green Valley Public School", city="Chandigarh", state="Punjab",
                   phone="+91 172 400 1234", email="office@greenvalley.edu", timezone="Asia/Kolkata",
                   currency="INR", address="Plot 12, Sector 26, Chandigarh 160019")

# One login per role, easy to remember. (email, name, role, role-specific details)
DEMO_USERS = [
    ("admin@demo.com", "Anita Sharma", Role.SCHOOL_ADMIN, {"phone": "+91 98140 10001", "designation": "Administrator"}),
    ("principal@demo.com", "Dr. Rajesh Kumar", Role.PRINCIPAL, {"phone": "+91 98140 10002", "designation": "Principal"}),
    ("teacher@demo.com", "Priya Verma", Role.TEACHER, {"phone": "+91 98140 10003", "employee_id": "T-001", "designation": "PGT Mathematics"}),
    ("accounts@demo.com", "Vikram Singh", Role.ACCOUNTANT, {"phone": "+91 98140 10004", "employee_id": "A-001", "designation": "Senior accountant"}),
    ("reception@demo.com", "Neha Gupta", Role.RECEPTIONIST, {"phone": "+91 98140 10005", "employee_id": "R-001", "designation": "Front office"}),
    ("librarian@demo.com", "Kavita Joshi", Role.LIBRARIAN, {"phone": "+91 98140 10006", "employee_id": "L-001", "designation": "Librarian"}),
    ("hr@demo.com", "Manoj Malhotra", Role.HR_MANAGER, {"phone": "+91 98140 10007", "employee_id": "H-001", "designation": "HR manager"}),
    ("transport@demo.com", "Gurpreet Kaur", Role.TRANSPORT_MANAGER, {"phone": "+91 98140 10008", "employee_id": "TR-001", "designation": "Transport in-charge"}),
    ("security@demo.com", "Ram Bahadur Thapa", Role.SECURITY_GUARD, {"phone": "+91 98140 10009", "employee_id": "S-001", "designation": "Head of security"}),
    ("staff@demo.com", "Sunita Devi", Role.STAFF, {"phone": "+91 98140 10010", "employee_id": "ST-001", "designation": "Office assistant"}),
    ("driver@demo.com", "Harpreet Singh", Role.DRIVER, {"phone": "+91 98140 30001", "license_no": "PB01 2015 0042817", "employee_id": "D-001"}),
    ("driver2@demo.com", "Baldev Raj", Role.DRIVER, {"phone": "+91 98140 30002", "license_no": "CH01 2012 0007731", "employee_id": "D-002"}),
    ("driver3@demo.com", "Mohd. Salim", Role.DRIVER, {"phone": "+91 98140 30003", "license_no": "PB65 2018 0019264", "employee_id": "D-003"}),
    ("parent@demo.com", "Suresh Patel", Role.PARENT, {"phone": "+91 98140 20001"}),
    ("student@demo.com", "Aarav Patel", Role.STUDENT, {}),
]

# ---- academics --------------------------------------------------------------------------------

PRE_PRIMARY = ["Nursery", "LKG", "UKG"]
CLASSES = PRE_PRIMARY + [f"Class {i}" for i in range(1, 13)]


def sections_for(cls: str) -> list[str]:
    if cls in PRE_PRIMARY:
        return ["A"]
    if cls in ("Class 11", "Class 12"):
        return ["Science", "Commerce"]
    return ["A", "B"]


def stage(cls: str, section: str) -> str:
    if cls in PRE_PRIMARY:
        return "pre"
    n = int(cls.split()[1])
    if n <= 5:
        return "primary"
    if n <= 10:
        return "middle"
    return "science" if section == "Science" else "commerce"


SUBJECTS = {  # name: (code, colour)
    "English": ("ENG", "rose"), "Hindi": ("HIN", "orange"), "Punjabi": ("PUN", "teal"), "Mathematics": ("MAT", "blue"),
    "Numbers": ("NUM", "blue"), "Rhymes & Stories": ("RHY", "pink"), "Play & Activity": ("PLAY", "lime"),
    "EVS": ("EVS", "lime"), "Science": ("SCI", "green"), "Social Science": ("SST", "amber"),
    "Computer Science": ("CS", "indigo"), "Physical Education": ("PE", "sky"), "Art & Craft": ("ART", "pink"),
    "Music": ("MUS", "violet"), "Physics": ("PHY", "sky"), "Chemistry": ("CHE", "teal"), "Biology": ("BIO", "green"),
    "Accountancy": ("ACC", "amber"), "Business Studies": ("BST", "orange"), "Economics": ("ECO", "violet"),
}

# Periods per week. Pre-primary is a half day (30 slots); everyone else has 45 (8 a day, 5 on Saturday).
CURRICULUM = {
    "pre": {"English": 6, "Hindi": 5, "Numbers": 6, "Rhymes & Stories": 4, "Art & Craft": 4, "Play & Activity": 5},
    "primary": {"English": 8, "Hindi": 7, "Mathematics": 9, "EVS": 6, "Punjabi": 4, "Computer Science": 3,
                "Art & Craft": 3, "Physical Education": 3, "Music": 2},
    "middle": {"English": 7, "Hindi": 6, "Mathematics": 8, "Science": 8, "Social Science": 7, "Punjabi": 3,
               "Computer Science": 3, "Physical Education": 2, "Art & Craft": 1},
    "science": {"English": 7, "Physics": 8, "Chemistry": 8, "Mathematics": 8, "Biology": 7, "Computer Science": 4,
                "Physical Education": 3},
    "commerce": {"English": 7, "Accountancy": 9, "Business Studies": 8, "Economics": 8, "Mathematics": 7,
                 "Computer Science": 3, "Physical Education": 3},
}

BELL = [  # (name, start, end, is_break)
    ("Assembly", time(7, 45), time(8, 0), True),
    ("Period 1", time(8, 0), time(8, 40), False),
    ("Period 2", time(8, 40), time(9, 20), False),
    ("Period 3", time(9, 20), time(10, 0), False),
    ("Short break", time(10, 0), time(10, 15), True),
    ("Period 4", time(10, 15), time(10, 55), False),
    ("Period 5", time(10, 55), time(11, 35), False),
    ("Lunch", time(11, 35), time(12, 5), True),
    ("Period 6", time(12, 5), time(12, 45), False),
    ("Period 7", time(12, 45), time(13, 25), False),
    ("Period 8", time(13, 25), time(14, 5), False),
]

# Teaching staff: (name, designation, subjects). Priya Verma (teacher@demo.com) is added separately.
TEACHERS = [
    ("Meenakshi Rao", "PRT Pre-primary", ["English", "Hindi", "Numbers", "Rhymes & Stories", "Art & Craft", "Play & Activity"]),
    ("Pooja Bansal", "PRT Pre-primary", ["English", "Hindi", "Numbers", "Rhymes & Stories", "Art & Craft", "Play & Activity"]),
    ("Ritu Arora", "PRT Pre-primary", ["English", "Hindi", "Numbers", "Rhymes & Stories", "Art & Craft", "Play & Activity"]),
    ("Sarah Thomas", "PGT English", ["English"]),
    ("Anjali Mehta", "TGT English", ["English"]),
    ("Deepa Nair", "TGT English", ["English"]),
    ("Rohit Khanna", "PRT English", ["English"]),
    ("Farah Khan", "PRT English", ["English"]),
    ("Sushma Tiwari", "TGT Hindi", ["Hindi"]),
    ("Ashok Pandey", "TGT Hindi", ["Hindi"]),
    ("Geeta Mishra", "PRT Hindi", ["Hindi"]),
    ("Rekha Yadav", "PRT Hindi", ["Hindi"]),
    ("Amit Saxena", "PGT Mathematics", ["Mathematics"]),
    ("Nitin Goyal", "TGT Mathematics", ["Mathematics"]),
    ("Shalini Kapoor", "TGT Mathematics", ["Mathematics"]),
    ("Vivek Chauhan", "PRT Mathematics", ["Mathematics"]),
    ("Harsh Vardhan", "PRT Mathematics", ["Mathematics"]),
    ("Lata Iyer", "PRT EVS", ["EVS"]),
    ("Manpreet Gill", "PRT EVS", ["EVS", "Science"]),
    ("Dr. Arvind Bose", "PGT Physics", ["Physics", "Science"]),
    ("Sneha Kulkarni", "PGT Chemistry", ["Chemistry", "Science"]),
    ("Dr. Kiran Bedi", "PGT Biology", ["Biology", "Science"]),
    ("Rajiv Menon", "TGT Science", ["Science"]),
    ("Alka Srivastava", "TGT Science", ["Science"]),
    ("Sanjay Dubey", "TGT Social Science", ["Social Science"]),
    ("Nandini Ghosh", "TGT Social Science", ["Social Science", "Economics"]),
    ("Harjit Brar", "TGT Social Science", ["Social Science"]),
    ("Jaswinder Kaur", "TGT Punjabi", ["Punjabi"]),
    ("Balwinder Sandhu", "PRT Punjabi", ["Punjabi"]),
    ("Kunal Bhatia", "PGT Computer Science", ["Computer Science"]),
    ("Divya Agarwal", "TGT Computer Science", ["Computer Science"]),
    ("Pankaj Rawat", "PET", ["Physical Education"]),
    ("Simran Dhillon", "PET", ["Physical Education"]),
    ("Monica D'Souza", "Art teacher", ["Art & Craft", "Music"]),
    ("Arijit Sen", "Music teacher", ["Music", "Art & Craft"]),
    ("CA Rakesh Jain", "PGT Commerce", ["Accountancy", "Business Studies"]),
    ("Dr. Usha Pillai", "PGT Economics", ["Economics", "Business Studies"]),
]
PART_TIME = {"Arijit Sen": [6], "Dr. Usha Pillai": [6]}  # weekday numbers they don't come in

BOYS = ["Aarav", "Vihaan", "Ishaan", "Arjun", "Kabir", "Reyansh", "Advik", "Atharv", "Vivaan", "Ayaan", "Dhruv", "Rohan",
        "Krish", "Aditya", "Sai", "Arnav", "Shaurya", "Rudra", "Yuvraj", "Kartik", "Parth", "Harshit", "Om", "Laksh",
        "Manav", "Pranav", "Siddharth", "Tanish", "Veer", "Yash", "Aryan", "Dev", "Jai", "Kunal", "Nikhil", "Rehan"]
GIRLS = ["Aanya", "Saanvi", "Myra", "Anika", "Kiara", "Navya", "Pari", "Ira", "Sara", "Meera", "Tara", "Zoya", "Diya",
         "Aadhya", "Riya", "Isha", "Kavya", "Prisha", "Avni", "Mahi", "Nitya", "Siya", "Trisha", "Vanya", "Anvi",
         "Ishita", "Jiya", "Khushi", "Mehak", "Navya", "Palak", "Ritika", "Sanya", "Tanvi", "Aditi", "Gauri"]
LAST = ["Sharma", "Verma", "Gupta", "Singh", "Mehta", "Kapoor", "Reddy", "Nair", "Iyer", "Joshi", "Malhotra", "Chopra",
        "Bhatia", "Sethi", "Arora", "Grewal", "Sandhu", "Bajwa", "Khurana", "Ahuja", "Saini", "Rana", "Thakur", "Bhalla",
        "Chawla", "Dhawan", "Goel", "Jindal", "Kohli", "Luthra", "Mittal", "Oberoi", "Puri", "Sood", "Tandon", "Walia"]
FATHERS = ["Rajesh", "Sunil", "Amit", "Sanjeev", "Manoj", "Vikas", "Rakesh", "Deepak", "Ajay", "Naveen", "Gaurav", "Harish",
           "Kamal", "Mohit", "Pradeep", "Ravi", "Sandeep", "Tarun", "Vinod", "Yogesh", "Ashwani", "Kuldeep", "Rajinder"]
MOTHERS = ["Sunita", "Anita", "Pooja", "Neha", "Rekha", "Seema", "Kiran", "Monika", "Nisha", "Payal", "Ritu", "Shweta",
           "Sonia", "Swati", "Vandana", "Archana", "Bhavna", "Deepika", "Jyoti", "Manisha", "Preeti", "Rashmi"]


async def wipe_demo_school(db) -> None:
    school = await db.scalar(select(School).where(School.slug == DEMO_SCHOOL["slug"]))
    if not school:
        return
    # Tables with RESTRICT foreign keys first; everything else cascades from the school.
    await db.execute(delete(TimetableEntry).where(TimetableEntry.school_id == school.id))
    await db.execute(delete(StudentGuardian).where(StudentGuardian.school_id == school.id))
    await db.execute(delete(Student).where(Student.school_id == school.id))
    await db.delete(school)
    await db.flush()
    print("Removed the old demo school.")


def email_for(name: str, taken: set[str], domain: str = "demo.com") -> str:
    base = "".join(c for c in name.lower().replace("dr. ", "").replace("ca ", "").replace(" ", ".") if c.isalnum() or c == ".")
    email, n = f"{base}@{domain}", 2
    while email in taken:
        email, n = f"{base}{n}@{domain}", n + 1
    taken.add(email)
    return email


def phone(rnd: random.Random) -> str:
    return f"+91 9{rnd.randint(100, 999)}{rnd.randint(0, 9)} {rnd.randint(10000, 99999)}"


async def seed_academics(db, school: School, users: dict[str, User], pw: str) -> None:
    """Classes, teachers, subjects, ~190 students with parents, and a clash-free timetable."""
    if await db.scalar(select(SchoolClass.id).where(SchoolClass.school_id == school.id)):
        return
    rnd = random.Random(2026)
    taken = set(users)

    # Classes and sections
    sections: list[tuple[str, Section]] = []
    for i, cname in enumerate(CLASSES, start=1):
        c = SchoolClass(school_id=school.id, name=cname, sort_order=i)
        db.add(c)
        await db.flush()
        for sname in sections_for(cname):
            s = Section(school_id=school.id, class_id=c.id, name=sname, capacity=40)
            db.add(s)
            sections.append((cname, s))
    await db.flush()

    # Subjects
    subjects: dict[str, Subject] = {}
    for name, (code, color) in SUBJECTS.items():
        subjects[name] = Subject(school_id=school.id, name=name, code=code, color=color)
        db.add(subjects[name])

    # Bell schedule
    periods = [Period(school_id=school.id, name=n, start_time=a, end_time=b, is_break=br, sort_order=i)
               for i, (n, a, b, br) in enumerate(BELL, start=1)]
    db.add_all(periods)

    # Teachers
    priya = users["teacher@demo.com"]
    teachers: dict[str, User] = {priya.full_name: priya}
    quals: dict[str, list[str]] = {priya.full_name: ["Mathematics"]}
    for n, (name, designation, subj) in enumerate(TEACHERS, start=2):
        t = User(school_id=school.id, email=email_for(name, taken), full_name=name, role=Role.TEACHER, password_hash=pw,
                 phone=phone(rnd), employee_id=f"T-{n:03d}", designation=designation)
        db.add(t)
        teachers[name], quals[name] = t, subj
    await db.flush()
    for name, subj in quals.items():
        db.add_all([TeacherSubject(school_id=school.id, teacher_id=teachers[name].id, subject_id=subjects[s].id) for s in subj])

    blocked: set[tuple] = set()  # (teacher name, day, period index)
    lesson_periods = [p for p in periods if not p.is_break]
    for name, days in PART_TIME.items():
        for d in days:
            for p in lesson_periods:
                db.add(TeacherUnavailability(school_id=school.id, teacher_id=teachers[name].id, day=d, period_id=p.id))
                blocked.add((name, d, p.id))

    # Who teaches what: every subject in a section gets one teacher, balancing load.
    pre_teachers = iter([t[0] for t in TEACHERS[:3]])
    load: Counter = Counter()
    owner: dict[tuple, str] = {}
    demand = []
    for cname, s in sections:
        st = stage(cname, s.name)
        pre = next(pre_teachers) if st == "pre" else None
        for subj, n in CURRICULUM[st].items():
            if pre:
                owner[(s.id, subj)] = pre
                load[pre] += n
            elif cname == "Class 5" and s.name == "A" and subj == "Mathematics":
                owner[(s.id, subj)] = priya.full_name
                load[priya.full_name] += n
            else:
                demand.append((s.id, subj, n))
    # Subjects with the fewest qualified teachers are assigned first.
    cands_for = {subj: [t for t, q in quals.items() if subj in q] for subj in SUBJECTS}
    for sid, subj, n in sorted(demand, key=lambda x: (len(cands_for[x[1]]), x[1], -x[2])):
        cands = cands_for[subj]
        best = min(cands, key=lambda t: (load[t] + n > 36, load[t] + 4 * len(PART_TIME.get(t, [])), rnd.random()))
        owner[(sid, subj)] = best
        load[best] += n

    # Place lessons: busiest teachers first, spreading each subject across the week.
    slots = {}
    for cname, s in sections:
        five = lesson_periods[:5]
        slots[s.id] = [(d, p.id) for d in range(1, 7)
                       for p in (five if stage(cname, s.name) == "pre" or d == 6 else lesson_periods)]
    free = {sid: set(v) for sid, v in slots.items()}
    order = {p.id: i for i, p in enumerate(periods)}  # sort by position, never by (random) id
    teacher_busy = set(blocked)
    per_day: Counter = Counter()
    stage_of = {s.id: stage(c, s.name) for c, s in sections}
    lessons = [(sid, subj, t) for (sid, subj), t in owner.items() for _ in range(CURRICULUM[stage_of[sid]][subj])]
    rnd.shuffle(lessons)
    lessons.sort(key=lambda x: -load[x[2]])
    room_no = {s.id: f"{'G' if cname in PRE_PRIMARY else ''}{101 + i}" for i, (cname, s) in enumerate(sections)}
    special_rooms = {"Computer Science": "Computer Lab", "Physical Education": "Ground", "Physics": "Physics Lab",
                     "Chemistry": "Chemistry Lab", "Biology": "Biology Lab", "Music": "Music Room"}

    entries, unplaced = [], []
    for sid, subj, tname in lessons:
        options = sorted((sl for sl in free[sid] if (tname, *sl) not in teacher_busy), key=lambda sl: (sl[0], order[sl[1]]))
        if not options:
            unplaced.append((sid, subj))
            continue
        d, pid = min(options, key=lambda sl: (per_day[(sid, subj, sl[0])], rnd.random()))
        free[sid].discard((d, pid))
        teacher_busy.add((tname, d, pid))
        per_day[(sid, subj, d)] += 1
        entries.append((sid, d, pid, subj, tname))
    # Anything left goes in a free slot with another qualified teacher who's free, or none.
    for sid, subj in unplaced:
        if not free[sid]:
            continue
        d, pid = sorted(free[sid], key=lambda sl: (per_day[(sid, subj, sl[0])], sl[0], order[sl[1]]))[0]
        sub = next((t for t, q in quals.items() if subj in q and (t, d, pid) not in teacher_busy), None)
        free[sid].discard((d, pid))
        if sub:
            teacher_busy.add((sub, d, pid))
        entries.append((sid, d, pid, subj, sub))
    db.add_all([TimetableEntry(school_id=school.id, section_id=sid, day=d, period_id=pid, subject_id=subjects[subj].id,
                               teacher_id=teachers[t].id if t else None, room=special_rooms.get(subj, room_no[sid]))
                for sid, d, pid, subj, t in entries])

    # Class teachers: whoever teaches the section most, at most one section each.
    taught: Counter = Counter((sid, t) for sid, _, _, _, t in entries if t)
    used: set[str] = set()
    for cname, s in sections:
        if cname == "Class 5" and s.name == "A":
            choice = priya.full_name
        else:
            ranked = sorted(((n, t) for (sid, t), n in taught.items() if sid == s.id and t not in used and t != priya.full_name), reverse=True)
            choice = ranked[0][1] if ranked else None
        if choice:
            s.class_teacher_id = teachers[choice].id
            used.add(choice)

    # Students, families and logins
    year = {c: 2026 - (i + 3) for i, c in enumerate(CLASSES)}  # birth year by class
    adm = 0

    def add_student(first, last, gender, cname, s, roll, dob=None, address=None):
        nonlocal adm
        adm += 1
        joined = max(2016, 2026 - rnd.randint(0, CLASSES.index(cname) + 1))
        st = Student(school_id=school.id, admission_no=f"GV{joined}{adm:04d}", first_name=first, last_name=last,
                     gender=gender, date_of_birth=dob or date(year[cname] - rnd.randint(0, 1), rnd.randint(1, 12), rnd.randint(1, 28)),
                     admission_date=date(joined, 4, 1), class_id=s.class_id, section_id=s.id, roll_no=roll,
                     blood_group=rnd.choice(["A+", "B+", "O+", "AB+", "O-", "A-", "B-"]),
                     address=address or f"House {rnd.randint(1, 3000)}, Sector {rnd.randint(7, 49)}, Chandigarh")
        db.add(st)
        return st

    by_name = {(c, s.name): s for c, s in sections}
    aarav = add_student("Aarav", "Patel", "male", "Class 5", by_name[("Class 5", "A")], 1, date(2015, 8, 21), "House 1142, Sector 21, Chandigarh")
    diya = add_student("Diya", "Patel", "female", "Class 1", by_name[("Class 1", "A")], 1, date(2019, 1, 9), "House 1142, Sector 21, Chandigarh")
    students: list[tuple[Student, str]] = []
    used_names: set[tuple[str, str]] = {("Aarav", "Patel"), ("Diya", "Patel")}
    for cname, s in sections:
        start = 2 if (cname, s.name) in (("Class 5", "A"), ("Class 1", "A")) else 1
        for roll in range(start, start + rnd.randint(6, 8)):
            while True:
                gender = rnd.choice(["male", "female"])
                first, last = rnd.choice(BOYS if gender == "male" else GIRLS), rnd.choice(LAST)
                if (first, last) not in used_names:
                    used_names.add((first, last))
                    break
            students.append((add_student(first, last, gender, cname, s, roll), cname))
    await db.flush()

    aarav.user_id = users["student@demo.com"].id
    dad = users["parent@demo.com"]
    mum = User(school_id=school.id, email="mother@demo.com", full_name="Kavita Patel", role=Role.PARENT, password_hash=pw, phone="+91 98140 20002")
    db.add(mum)
    await db.flush()
    db.add_all([
        StudentGuardian(school_id=school.id, student_id=aarav.id, user_id=dad.id, relationship="father", is_primary=True),
        StudentGuardian(school_id=school.id, student_id=diya.id, user_id=dad.id, relationship="father", is_primary=True),
        StudentGuardian(school_id=school.id, student_id=aarav.id, user_id=mum.id, relationship="mother"),
        StudentGuardian(school_id=school.id, student_id=diya.id, user_id=mum.id, relationship="mother"),
    ])

    # Families: some siblings share parents (same surname, different classes).
    rnd.shuffle(students)
    families: list[list[Student]] = []
    by_last: dict[str, list[Student]] = defaultdict(list)
    for st, _ in students:
        fam = by_last[st.last_name]
        if fam and len(fam[-1]) < 2 and rnd.random() < 0.35 and all(x.class_id != st.class_id for x in fam[-1]):
            fam[-1].append(st)
        else:
            fam.append([st])
            families.append(fam[-1])
    for fam in families:
        last = fam[0].last_name
        father = User(school_id=school.id, full_name=f"{rnd.choice(FATHERS)} {last}", role=Role.PARENT, password_hash=pw, phone=phone(rnd))
        father.email = email_for(father.full_name, taken)
        db.add(father)
        mother = None
        if rnd.random() < 0.4:
            mother = User(school_id=school.id, full_name=f"{rnd.choice(MOTHERS)} {last}", role=Role.PARENT, password_hash=pw, phone=phone(rnd))
            mother.email = email_for(mother.full_name, taken)
            db.add(mother)
        await db.flush()
        for st in fam:
            db.add(StudentGuardian(school_id=school.id, student_id=st.id, user_id=father.id, relationship="father", is_primary=True))
            if mother:
                db.add(StudentGuardian(school_id=school.id, student_id=st.id, user_id=mother.id, relationship="mother"))

    # Senior students (Class 9-12) get their own app login.
    for st, cname in students:
        if cname in ("Class 9", "Class 10", "Class 11", "Class 12") and st.roll_no and st.roll_no <= 2:
            u = User(school_id=school.id, full_name=f"{st.first_name} {st.last_name}", role=Role.STUDENT, password_hash=pw,
                     email=email_for(f"{st.first_name} {st.last_name}", taken, "students.demo.com"))
            db.add(u)
            await db.flush()
            st.user_id = u.id

    placed = sum(1 for e in entries if e[4])
    print(f"  {len(sections)} sections, {len(students) + 2} students, {len(families) + 1} families, {len(teachers)} teachers")
    print(f"  Timetable: {len(entries)} lessons, {placed} with a teacher, {len(entries) - placed} need one")


async def seed(reset: bool = False) -> None:
    if settings.ENVIRONMENT == "production":
        raise SystemExit("Refusing to seed demo data in production")
    async with system_session() as db:
        if reset:
            await wipe_demo_school(db)
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
                existing[email] = User(school_id=school.id, email=email, full_name=name, role=role, password_hash=pw, **extra)
                db.add(existing[email])
            else:  # fill details added since the account was created
                for k, v in extra.items():
                    if not getattr(existing[email], k):
                        setattr(existing[email], k, v)
        await db.flush()
        await seed_academics(db, school, existing, pw)

    print("Seed complete.")
    print(f"  Super admin : {SUPER_ADMIN[0]} / {SUPER_ADMIN[2]}  (no school ID)")
    print(f"  Demo school : school ID 'demo', password {DEMO_PASSWORD} for:")
    for email, _, role, _ in DEMO_USERS:
        print(f"    {role:<18} {email}")
    print("    parent             mother@demo.com (Aarav and Diya's mother)")
    print("  Every other teacher, parent and student also uses Demo@1234 - see Settings > Users.")


if __name__ == "__main__":
    asyncio.run(seed(reset="--reset" in sys.argv))
