"""Demo data for syllabus, lesson plans, admission enquiries, certificates and substitutions. Called from app.seed."""
import random
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.models import (
    Certificate, Enquiry, LessonPlan, School, SchoolClass, Section, Student, Subject, Substitution, SyllabusTopic, TimetableEntry,
    TopicProgress, User,
)

SYLLABUS = {
    ("primary", "Mathematics"): ["Numbers: Large numbers", "Numbers: Place value", "Operations: Addition and subtraction", "Operations: Multiplication",
                                 "Operations: Division", "Fractions: Parts of a whole", "Fractions: Equivalent fractions", "Measurement: Length and weight",
                                 "Geometry: Shapes and angles", "Data: Pictographs and bar graphs"],
    ("middle", "Mathematics"): ["Number system: Integers", "Number system: Fractions and decimals", "Algebra: Simple equations",
                                "Algebra: Algebraic expressions", "Ratio: Ratio and proportion", "Ratio: Percentages", "Geometry: Lines and angles",
                                "Geometry: Triangles", "Mensuration: Perimeter and area", "Data handling: Mean, median and mode"],
    ("board", "Mathematics"): ["Number systems: Real numbers", "Algebra: Polynomials", "Algebra: Linear equations in two variables",
                               "Algebra: Quadratic equations", "Algebra: Arithmetic progressions", "Geometry: Triangles", "Geometry: Circles",
                               "Coordinate geometry", "Trigonometry: Ratios and identities", "Mensuration: Surface area and volume", "Statistics",
                               "Probability"],
    ("any", "English"): ["Prose: Lesson 1", "Poetry: Poem 1", "Grammar: Nouns and pronouns", "Prose: Lesson 2", "Grammar: Tenses",
                         "Writing: Letter writing", "Poetry: Poem 2", "Grammar: Active and passive voice", "Writing: Story writing", "Prose: Lesson 3"],
    ("primary", "EVS"): ["Family and friends", "Plants around us", "Animals and their homes", "Food we eat", "Water", "Our body",
                         "Weather and seasons", "Transport", "Our neighbourhood"],
    ("middle", "Science"): ["Living world: Nutrition in plants", "Living world: Nutrition in animals", "Matter: Fibre to fabric",
                            "Matter: Acids, bases and salts", "Physics: Heat", "Physics: Motion and time", "Physics: Electric current",
                            "Living world: Respiration", "Earth: Weather and climate", "Physics: Light"],
    ("board", "Science"): ["Chemistry: Chemical reactions", "Chemistry: Acids, bases and salts", "Chemistry: Metals and non-metals",
                           "Chemistry: Carbon compounds", "Biology: Life processes", "Biology: Control and coordination", "Biology: Heredity",
                           "Physics: Light", "Physics: Electricity", "Physics: Magnetic effects of current"],
    ("middle", "Social Science"): ["History: Tracing changes", "History: New kings and kingdoms", "Geography: Environment",
                                   "Geography: Our changing earth", "Civics: On equality", "Civics: Role of the government in health",
                                   "History: The Mughal empire", "Geography: Air and water", "Civics: Media and democracy", "Economics: Markets around us"],
}

ENQUIRIES = [  # (child, class, parent, source, status, follow-up in days or None, note)
    ("Ishaan Mehra", "Class 1", "Rohit Mehra", "walk_in", "new", 0, "Wants to see the smart classrooms"),
    ("Saanvi Arora", "LKG", "Pooja Arora", "website", "new", 1, None),
    ("Vivaan Bedi", "Class 6", "Karan Bedi", "phone", "contacted", -2, "Moving from Delhi in November"),
    ("Myra Chawla", "Nursery", "Ritu Chawla", "referral", "visit", 2, "Referred by the Patel family"),
    ("Arjun Dhillon", "Class 9", "Harjit Dhillon", "walk_in", "applied", 3, "Asked about the science stream for Class 11"),
    ("Kiara Sethi", "Class 3", "Nidhi Sethi", "website", "contacted", 0, "Needs bus from Sector 44"),
    ("Reyansh Gill", "Class 11", "Amarjeet Gill", "phone", "visit", 5, "Commerce stream"),
    ("Anika Bansal", "UKG", "Sonia Bansal", "walk_in", "lost", None, "Chose a school closer to home"),
    ("Aditya Kohli", "Class 4", "Varun Kohli", "referral", "applied", -1, "Documents pending: birth certificate"),
    ("Navya Grover", "Class 2", "Meenakshi Grover", "website", "new", None, None),
    ("Kabir Ahuja", "Class 7", "Deepak Ahuja", "phone", "contacted", 4, None),
    ("Zara Khanna", "Class 5", "Simran Khanna", "walk_in", "lost", None, "Fees above budget"),
]


def _stage(class_name: str) -> str | None:
    if not class_name.startswith("Class "):
        return None
    n = int(class_name.split()[1])
    return "primary" if n <= 5 else "middle" if n <= 8 else "board" if n <= 10 else None


def _month(start: date, i: int, n: int) -> str:
    m = start.month - 1 + (i * 11) // n
    return f"{start.year + m // 12}-{m % 12 + 1:02d}"


async def seed_academics_extras(db, school: School, today: date) -> None:
    if await db.scalar(select(SyllabusTopic.id).where(SyllabusTopic.school_id == school.id).limit(1)):
        return
    rnd = random.Random(53)
    year_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
    this_month = today.strftime("%Y-%m")
    subjects = {s.name: s for s in (await db.scalars(select(Subject).where(Subject.school_id == school.id))).all()}
    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    classes = (await db.scalars(select(SchoolClass).where(SchoolClass.school_id == school.id))).all()
    sections = {}
    for s in (await db.scalars(select(Section).where(Section.school_id == school.id))).all():
        sections.setdefault(s.class_id, []).append(s)

    # Syllabus with progress: topics planned for earlier months are mostly done; this month's half done.
    topic_count = done_count = 0
    topics_by: dict[tuple, list[SyllabusTopic]] = {}
    for c in classes:
        stage = _stage(c.name)
        if not stage:
            continue
        for (st, subj_name), lines in SYLLABUS.items():
            if st not in (stage, "any") or subj_name not in subjects:
                continue
            made = []
            for i, line in enumerate(lines):
                unit, _, title = line.partition(": ")
                t = SyllabusTopic(school_id=school.id, class_id=c.id, subject_id=subjects[subj_name].id, unit=unit if title else None,
                                  title=title or line, planned_month=_month(year_start, i, len(lines)), sort_order=i + 1)
                db.add(t)
                made.append(t)
            await db.flush()
            topic_count += len(made)
            topics_by[(c.id, subjects[subj_name].id)] = made
            for sec in sections.get(c.id, []):
                for t in made:
                    p = 0.93 if t.planned_month < this_month else 0.5 if t.planned_month == this_month else 0
                    if rnd.random() < p:
                        y, m = map(int, t.planned_month.split("-"))
                        when = min(date(y, m, rnd.randint(5, 25)), today)
                        db.add(TopicProgress(school_id=school.id, topic_id=t.id, section_id=sec.id, completed_on=when))
                        done_count += 1

    # Lesson plans for Priya Verma (teacher@demo.com) this week.
    teacher = users.get("teacher@demo.com")
    plans = 0
    if teacher:
        week = today - timedelta(days=today.weekday())
        done_ids = set((await db.scalars(select(TopicProgress.topic_id).where(TopicProgress.school_id == school.id))).all())
        entries = (await db.scalars(select(TimetableEntry).where(TimetableEntry.teacher_id == teacher.id))).all()
        section_class = {s.id: s.class_id for ss in sections.values() for s in ss}
        seen = set()
        for e in sorted(entries, key=lambda e: e.day):
            day = week + timedelta(days=e.day - 1)
            key = (e.section_id, e.subject_id, day)
            if key in seen:
                continue
            seen.add(key)
            topics = topics_by.get((section_class.get(e.section_id), e.subject_id), [])
            nxt = next((t for t in topics if t.id not in done_ids), None)
            if not nxt:
                continue
            db.add(LessonPlan(school_id=school.id, section_id=e.section_id, subject_id=e.subject_id, topic_id=nxt.id, date=day,
                              title=f"{nxt.title}: {rnd.choice(['introduction', 'worked examples', 'practice and doubts', 'class test'])}",
                              objectives=f"Students can explain and apply {nxt.title.lower()}.",
                              activities="Warm-up questions, explanation on the board, pair work, exit ticket.",
                              resources="Textbook, worksheet", status="taught" if day < today else "planned", teacher_id=teacher.id))
            plans += 1

    # Admission enquiries.
    class_ids = {c.name: c.id for c in classes}
    reception = users.get("reception@demo.com")
    for i, (child, cname, parent, source, status, follow, note) in enumerate(ENQUIRIES):
        created = datetime.now(UTC) - timedelta(days=rnd.randint(1, 25), hours=rnd.randint(0, 8))
        notes = [{"at": created.isoformat(), "by": "Website" if source == "website" else "Neha Gupta", "text": note}] if note else []
        db.add(Enquiry(school_id=school.id, student_name=child, class_id=class_ids.get(cname), parent_name=parent,
                       phone=f"+91 98{rnd.randint(100, 999)} {rnd.randint(10000, 99999)}",
                       email=f"{parent.split()[0].lower()}.{parent.split()[1].lower()}@example.com" if i % 3 else None,
                       source=source, status=status, follow_up_on=today + timedelta(days=follow) if follow is not None else None,
                       assigned_to=reception.id if reception else None, notes=notes, created_at=created, updated_at=created))

    # A few certificates.
    students = (await db.scalars(select(Student).where(Student.school_id == school.id, Student.status == "active")
                                 .order_by(Student.admission_no).limit(3))).all()
    admin = users.get("admin@demo.com")
    year = year_start.year
    for n, (s, kind, details) in enumerate(zip(students, ["bonafide", "bonafide", "character"],
                                               [{"purpose": "Opening a bank account"}, {"purpose": "Passport application"}, {"conduct": "Very good"}])):
        prefix = {"bonafide": "BC", "character": "CC"}[kind]
        serial = f"{prefix}/{year}-{str(year + 1)[2:]}/{(n + 1 if kind == 'bonafide' else 1):04d}"
        db.add(Certificate(school_id=school.id, student_id=s.id, kind=kind, serial_no=serial, issued_on=today - timedelta(days=10 - n * 3),
                           details=details, issued_by=admin.id if admin else None))

    # A teacher away today, with covers.
    covers = 0
    if today.isoweekday() <= 6:
        todays = (await db.scalars(select(TimetableEntry).where(TimetableEntry.school_id == school.id, TimetableEntry.day == today.isoweekday(),
                                                                TimetableEntry.teacher_id.is_not(None)))).all()
        by_teacher: dict = {}
        for e in todays:
            by_teacher.setdefault(e.teacher_id, []).append(e)
        busy = {(e.teacher_id, e.period_id) for e in todays}
        away = next((tid for tid, es in sorted(by_teacher.items(), key=lambda x: -len(x[1]))
                     if teacher is None or tid != teacher.id), None)
        if away:
            free_pool = [tid for tid in by_teacher if tid != away]
            for e in by_teacher[away]:
                sub = Substitution(school_id=school.id, date=today, entry_id=e.id, absent_teacher_id=away, created_by=admin.id if admin else None)
                if covers < 3:  # leave the rest for the admin to try
                    pick = teacher.id if teacher and (teacher.id, e.period_id) not in busy and covers == 0 else next(
                        (t for t in free_pool if (t, e.period_id) not in busy), None)
                    if pick:
                        sub.substitute_id = pick
                        busy.add((pick, e.period_id))
                        covers += 1
                db.add(sub)
    await db.flush()
    print(f"  Syllabus: {topic_count} topics, {done_count} finished; lesson plans: {plans}; enquiries: {len(ENQUIRIES)}; "
          f"certificates: 3; covers today: {covers}")


async def seed_attendance_extras(db, school: School, today: date) -> None:
    from app.models import BiometricDevice, BiometricPunch, CalendarEvent, LeaveRequest, StudentGuardian
    if await db.scalar(select(CalendarEvent.id).where(CalendarEvent.school_id == school.id).limit(1)):
        return
    rnd = random.Random(71)
    y = today.year if today.month >= 4 else today.year - 1
    events = [("Independence Day", "holiday", date(y, 8, 15), date(y, 8, 15)), ("Raksha Bandhan", "holiday", date(y, 8, 28), date(y, 8, 28)),
              ("Gandhi Jayanti", "holiday", date(y, 10, 2), date(y, 10, 2)), ("Diwali vacation", "vacation", date(y, 10, 19), date(y, 10, 24)),
              ("Guru Nanak Jayanti", "holiday", date(y, 11, 5), date(y, 11, 5)), ("Christmas", "holiday", date(y, 12, 25), date(y, 12, 25)),
              ("Winter vacation", "vacation", date(y + 1, 1, 1), date(y + 1, 1, 10)), ("Republic Day", "holiday", date(y + 1, 1, 26), date(y + 1, 1, 26)),
              ("Summer vacation", "vacation", date(y, 6, 1), date(y, 6, 30)),
              ("Parent-teacher meeting", "ptm", today + timedelta(days=9), today + timedelta(days=9)),
              ("Annual sports day", "event", today + timedelta(days=16), today + timedelta(days=16)),
              ("Science exhibition", "event", today + timedelta(days=30), today + timedelta(days=30)),
              ("Half-yearly exams", "exam", date(y, 9, 14), date(y, 9, 24)), ("Final exams", "exam", date(y + 1, 3, 2), date(y + 1, 3, 14))]
    for title, kind, start, end in events:
        db.add(CalendarEvent(school_id=school.id, title=title, kind=kind, start_date=start, end_date=end))

    # Leave: the Patels have one waiting and one approved earlier; a few other families too.
    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    parent = users.get("parent@demo.com")
    kids = (await db.scalars(select(Student).join(StudentGuardian, StudentGuardian.student_id == Student.id)
                             .where(StudentGuardian.user_id == parent.id).order_by(Student.first_name))).all() if parent else []
    nxt = today + timedelta(days=4 if today.weekday() != 2 else 5)
    nxt += timedelta(days=1) if nxt.weekday() == 6 else timedelta(0)
    if kids:
        db.add(LeaveRequest(school_id=school.id, student_id=kids[0].id, from_date=nxt, to_date=nxt + timedelta(days=1), kind="family",
                            reason="Cousin's wedding in Jaipur. We'll be back on Monday.", requested_by=parent.id))
        past = today - timedelta(days=12)
        db.add(LeaveRequest(school_id=school.id, student_id=kids[0].id, from_date=past, to_date=past, kind="sick",
                            reason="Fever and cold; doctor advised a day's rest.", requested_by=parent.id, status="approved",
                            decided_by=users["teacher@demo.com"].id if "teacher@demo.com" in users else None,
                            decided_at=datetime.now(UTC) - timedelta(days=13), decision_note="Get well soon"))
    others = (await db.execute(select(Student, StudentGuardian.user_id).join(StudentGuardian, StudentGuardian.student_id == Student.id)
                               .where(Student.school_id == school.id, Student.status == "active").limit(40))).all()
    for s, uid in rnd.sample(others, min(4, len(others))):
        if parent and uid == parent.id:
            continue
        start = today + timedelta(days=rnd.randint(1, 10))
        start += timedelta(days=1) if start.weekday() == 6 else timedelta(0)
        db.add(LeaveRequest(school_id=school.id, student_id=s.id, from_date=start, to_date=start + timedelta(days=rnd.choice([0, 1, 2])),
                            kind=rnd.choice(["sick", "family", "travel"]), requested_by=uid,
                            reason=rnd.choice(["Going to grandparents' village for a family function.", "Doctor's appointment in the morning.",
                                               "Travelling for a family wedding.", "Unwell since yesterday."])))

    # A biometric machine at the gate, with Class 5's numbers enrolled and this morning's punches.
    settings = dict(school.settings or {})
    settings.setdefault("late_after", "08:10")
    school.settings = settings
    dev = BiometricDevice(school_id=school.id, serial_no="CQZ7231460001", name="Main gate", location="Front entrance", punches=0)
    db.add(dev)
    await db.flush()
    c5 = await db.scalar(select(Section).join(SchoolClass, SchoolClass.id == Section.class_id)
                         .where(SchoolClass.school_id == school.id, SchoolClass.name == "Class 5", Section.name == "A"))
    if c5:
        tz = ZoneInfo(school.timezone or "Asia/Kolkata")
        for i, s in enumerate((await db.scalars(select(Student).where(Student.section_id == c5.id, Student.status == "active")
                                                .order_by(Student.roll_no))).all()):
            s.biometric_id = str(501 + i)
            if today.weekday() != 6:
                at = datetime.combine(today, datetime.min.time(), tz).replace(hour=7, minute=40) + timedelta(minutes=rnd.randint(0, 35))
                db.add(BiometricPunch(school_id=school.id, device_id=dev.id, pin=s.biometric_id, punched_at=at, student_id=s.id))
                dev.punches += 1
        dev.last_seen = datetime.now(UTC) - timedelta(hours=2)
    for i, email in enumerate(["teacher@demo.com", "principal@demo.com", "reception@demo.com"]):
        if email in users:
            users[email].biometric_id = str(9001 + i)
    await db.flush()
    print(f"  Calendar: {len(events)} entries; leave requests seeded; 1 attendance machine")


async def seed_accounts(db, school: School, today: date) -> None:
    from decimal import Decimal

    from app.models import AccountEntry, LedgerHead, SchoolModule
    from app.services.accounts_service import DEFAULT_HEADS
    if await db.scalar(select(LedgerHead.id).where(LedgerHead.school_id == school.id).limit(1)):
        return
    rnd = random.Random(97)
    heads = {}
    for kind, names in DEFAULT_HEADS.items():
        for n in names:
            heads[n] = LedgerHead(school_id=school.id, kind=kind, name=n)
            db.add(heads[n])
    await db.flush()
    # Monthly running costs since July, plus a few one-offs and some non-fee income.
    monthly = [("Salaries", 1_150_000, "bank_transfer", "Staff salaries"), ("Electricity and water", 48_000, "bank_transfer", "PSPCL / MC water"),
               ("Internet and phone", 6_500, "upi", "Airtel broadband"), ("Transport fuel", 72_000, "card", "Indian Oil fuel card"),
               ("Stationery and printing", 15_000, "cash", "Sharma Stationers")]
    one_off = [("Maintenance and repairs", 38_500, "cheque", "Gill Builders", "Classroom ceiling repair"),
               ("Events and functions", 64_000, "bank_transfer", "Star Tent House", "Independence Day celebration"),
               ("Maintenance and repairs", 12_400, "cash", "Kumar Electricals", "Fans and lights"),
               ("Events and functions", 21_000, "upi", "Sweets and snacks", "Teachers' Day")]
    income = [("Canteen and shop rent", 25_000, "bank_transfer", "Annapurna Canteen"), ("Bus hire", 18_000, "upi", "Rotary Club picnic"),
              ("Donations", 100_000, "cheque", "Alumni association"), ("Interest", 4_250, "bank_transfer", "SBI savings interest")]
    counter = {"income": 0, "expense": 0}

    def voucher(kind: str) -> str:
        counter[kind] += 1
        return f"{'RV' if kind == 'income' else 'PV'}-{str(today.year if today.month >= 4 else today.year - 1)[2:]}{str((today.year if today.month >= 4 else today.year - 1) + 1)[2:]}-{counter[kind]:05d}"

    d = date(today.year, 7, 1) if today.month >= 7 else date(today.year - 1, 7, 1)
    while d <= today:
        for head, amount, method, party in monthly:
            day = d.replace(day=rnd.randint(1, 7))
            if day > today:
                continue
            db.add(AccountEntry(school_id=school.id, voucher_no=voucher("expense"), kind="expense", head_id=heads[head].id, date=day,
                                amount=Decimal(amount + rnd.randint(-2, 2) * 500), party=party, method=method,
                                reference=f"CHQ{rnd.randint(100000, 999999)}" if method == "cheque" else None, note=f"{d:%B} {head.lower()}"))
        head, amount, method, party = income[0]
        db.add(AccountEntry(school_id=school.id, voucher_no=voucher("income"), kind="income", head_id=heads[head].id, date=min(d.replace(day=5), today),
                            amount=Decimal(amount), party=party, method=method, note=f"{d:%B} rent"))
        d = (d + timedelta(days=32)).replace(day=1)
    for head, amount, method, party, note in one_off:
        day = today - timedelta(days=rnd.randint(5, 80))
        db.add(AccountEntry(school_id=school.id, voucher_no=voucher("expense"), kind="expense", head_id=heads[head].id, date=day,
                            amount=Decimal(amount), party=party, method=method,
                            reference=f"{rnd.randint(100000, 999999)}" if method == "cheque" else None, note=note))
    for head, amount, method, party in income[1:]:
        day = today - timedelta(days=rnd.randint(3, 60))
        db.add(AccountEntry(school_id=school.id, voucher_no=voucher("income"), kind="income", head_id=heads[head].id, date=day,
                            amount=Decimal(amount), party=party, method=method, reference=f"{rnd.randint(100000, 999999)}" if method == "cheque" else None))
    settings = dict(school.settings or {})
    settings.setdefault("late_fee", {"enabled": True, "mode": "flat", "amount": 200, "grace_days": 7, "max_amount": None})
    school.settings = settings
    mod = await db.scalar(select(SchoolModule).where(SchoolModule.school_id == school.id, SchoolModule.module == "accounts"))
    if mod:
        mod.is_enabled = True
    await db.flush()
    print(f"  Accounts: {counter['expense']} expense and {counter['income']} income vouchers; late fee Rs. 200 after 7 days")


async def seed_online(db, school: School, today: date) -> None:
    from decimal import Decimal

    from app.models import CoScholasticArea, CoScholasticGrade, Exam, LiveClass, OnlineTest, Question
    if await db.scalar(select(Question.id).where(Question.school_id == school.id).limit(1)):
        return
    rnd = random.Random(113)
    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    teacher = users.get("teacher@demo.com")
    subjects = {s.name: s for s in (await db.scalars(select(Subject).where(Subject.school_id == school.id))).all()}
    c5 = await db.scalar(select(SchoolClass).where(SchoolClass.school_id == school.id, SchoolClass.name == "Class 5"))
    if not c5 or "Mathematics" not in subjects:
        return
    maths = subjects["Mathematics"]
    sections = (await db.scalars(select(Section).where(Section.class_id == c5.id))).all()
    bank = [
        ("single", "What is 3/4 of 20?", [("a", "12"), ("b", "15"), ("c", "16"), ("d", "18")], ["b"], 1),
        ("single", "Which fraction is equal to 1/2?", [("a", "2/3"), ("b", "3/6"), ("c", "4/6"), ("d", "1/3")], ["b"], 1),
        ("multiple", "Select all the even numbers.", [("a", "14"), ("b", "21"), ("c", "36"), ("d", "45")], ["a", "c"], 2),
        ("true_false", "A square has four lines of symmetry.", [], ["t"], 1),
        ("single", "The place value of 7 in 47,302 is", [("a", "7"), ("b", "70"), ("c", "700"), ("d", "7,000")], ["d"], 1),
        ("single", "How many minutes are there in 2 1/2 hours?", [("a", "120"), ("b", "130"), ("c", "150"), ("d", "250")], ["c"], 1),
        ("true_false", "0.5 is greater than 0.45.", [], ["t"], 1),
        ("short", "Write 0.75 as a fraction in its lowest terms.", [], ["3/4"], 2),
        ("single", "Perimeter of a rectangle 8 cm by 5 cm is", [("a", "13 cm"), ("b", "26 cm"), ("c", "40 cm"), ("d", "21 cm")], ["b"], 1),
        ("short", "Explain in one line why 1/3 is smaller than 1/2.", [], [], 2),
    ]
    qs = []
    for kind, text, options, answer, marks in bank:
        opts = [{"id": "t", "text": "True"}, {"id": "f", "text": "False"}] if kind == "true_false" else [{"id": i, "text": t} for i, t in options]
        q = Question(school_id=school.id, class_id=c5.id, subject_id=maths.id, kind=kind, text=text, options=opts, answer=answer,
                     marks=Decimal(marks), created_by=teacher.id if teacher else None, topic="Revision")
        db.add(q)
        qs.append(q)
    await db.flush()
    now = datetime.now(UTC)
    db.add(OnlineTest(school_id=school.id, title="Fractions and numbers quiz", instructions="Answer every question. You have 20 minutes once you start.",
                      class_id=c5.id, subject_id=maths.id, section_ids=[s.id for s in sections], question_ids=[q.id for q in qs[:8]],
                      opens_at=now - timedelta(hours=2), closes_at=now + timedelta(days=5), duration_minutes=20, shuffle=True,
                      show_results="after_submit", published=True, created_by=teacher.id if teacher else None))
    db.add(OnlineTest(school_id=school.id, title="Measurement check (draft)", class_id=c5.id, subject_id=maths.id,
                      section_ids=[s.id for s in sections], question_ids=[qs[5].id, qs[8].id, qs[9].id], opens_at=now + timedelta(days=3),
                      closes_at=now + timedelta(days=4), duration_minutes=15, published=False, created_by=teacher.id if teacher else None))

    # Co-scholastic grades for the published Half-Yearly in Class 5.
    areas = []
    for i, n in enumerate(["Work education", "Art education", "Health and physical education", "Discipline"]):
        areas.append(CoScholasticArea(school_id=school.id, name=n, sort_order=i))
        db.add(areas[-1])
    await db.flush()
    exam = await db.scalar(select(Exam).where(Exam.school_id == school.id, Exam.name == "Half-Yearly"))
    if exam:
        for st in (await db.scalars(select(Student).where(Student.class_id == c5.id, Student.status == "active"))).all():
            for a in areas:
                db.add(CoScholasticGrade(school_id=school.id, exam_id=exam.id, student_id=st.id, area_id=a.id, grade=rnd.choices("ABC", [5, 4, 1])[0]))

    # Live classes: one tomorrow, one next week.
    slug = school.slug
    for days, hour, title in ((1, 16, "Fractions doubt-clearing session"), (6, 17, "Geometry: shapes around us")):
        start = datetime.combine(today + timedelta(days=days), datetime.min.time(), ZoneInfo(school.timezone)).replace(hour=hour)
        db.add(LiveClass(school_id=school.id, title=title, section_ids=[s.id for s in sections], subject_id=maths.id, starts_at=start,
                         duration_minutes=45, meeting_url=f"https://meet.jit.si/eduvia-{slug}-maths{days}{rnd.randint(1000, 9999)}",
                         notes="Keep your maths notebook ready.", teacher_id=teacher.id if teacher else None))
    await db.flush()
    print(f"  Online tests: {len(qs)} questions, 1 open test; co-scholastic grades for Class 5; 2 live classes")


async def seed_communication(db, school: School, today: date) -> None:
    from datetime import time as dtime

    from app.models import ChatMessage, Conversation, MessageLog, PtmEvent, StudentGuardian, Survey, SurveyResponse
    if await db.scalar(select(PtmEvent.id).where(PtmEvent.school_id == school.id).limit(1)):
        return
    rnd = random.Random(131)
    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    sections = (await db.scalars(select(Section).where(Section.school_id == school.id))).all()
    admin, teacher, parent = users.get("admin@demo.com"), users.get("teacher@demo.com"), users.get("parent@demo.com")
    from app.services.attendance_extra_service import closed_days
    closed = await closed_days(db, school.id, today, today + timedelta(days=60))
    ptm_day = next(today + timedelta(days=d) for d in range(4, 60) if today + timedelta(days=d) not in closed)
    db.add(PtmEvent(school_id=school.id, title="Term 1 parent-teacher meeting", date=ptm_day, start_time=dtime(9, 0), end_time=dtime(12, 0),
                    slot_minutes=10, section_ids=[s.id for s in sections], location="Each class's own room",
                    notes="Please bring the term 1 report card.", created_by=admin.id if admin else None))

    # A conversation between the Patels and Aarav's class teacher.
    aarav = await db.scalar(select(Student).where(Student.school_id == school.id, Student.first_name == "Aarav", Student.last_name == "Patel"))
    if aarav and teacher and parent:
        c = Conversation(school_id=school.id, student_id=aarav.id, family_id=parent.id, staff_id=teacher.id)
        db.add(c)
        await db.flush()
        start = datetime.now(UTC) - timedelta(days=1, hours=3)
        for i, (who, body) in enumerate([(parent, "Good morning ma'am. Aarav was unwell yesterday; could you share what was taught in maths?"),
                                         (teacher, "Hope he is better now. We did fractions on a number line, Exercise 4.2. He can take my notes tomorrow."),
                                         (parent, "Thank you so much!"),
                                         (teacher, "Also, please remind him to bring his geometry box on Monday.")]):
            db.add(ChatMessage(school_id=school.id, conversation_id=c.id, sender_id=who.id, body=body, created_at=start + timedelta(minutes=40 * i),
                               read_at=start + timedelta(minutes=40 * i + 5) if i < 3 else None))
        c.last_message_at = start + timedelta(minutes=120)

    # A published survey with some answers.
    s = Survey(school_id=school.id, title="School canteen feedback", description="Help us improve the food at school. It takes a minute.",
               audience="families", published=True, created_by=admin.id if admin else None, closes_at=datetime.now(UTC) + timedelta(days=14),
               questions=[{"id": "q1", "kind": "rating", "text": "How would you rate the canteen food?", "options": [], "required": True},
                          {"id": "q2", "kind": "choice", "text": "How often does your child eat at the canteen?",
                           "options": ["Every day", "A few times a week", "Rarely", "Never"], "required": True},
                          {"id": "q3", "kind": "multi", "text": "What would you like added?", "options": ["Fresh fruit", "Millet snacks", "Salads", "Juices"],
                           "required": False},
                          {"id": "q4", "kind": "text", "text": "Any other suggestions?", "options": [], "required": False}])
    db.add(s)
    await db.flush()
    families = (await db.scalars(select(User).join(StudentGuardian, StudentGuardian.user_id == User.id)
                                 .where(User.school_id == school.id, User.role == "parent").distinct().limit(40))).all()
    notes = ["More fruit please", "Food is good but portions are small", "Add some South Indian options", "Keep it less oily", ""]
    for u in families:
        if parent and u.id == parent.id:
            continue  # leave it for the demo parent to answer
        db.add(SurveyResponse(school_id=school.id, survey_id=s.id, user_id=u.id, answers={
            "q1": rnd.choice([3, 4, 4, 5, 2]), "q2": rnd.choice(s.questions[1]["options"]),
            "q3": rnd.sample(s.questions[2]["options"], rnd.randint(0, 2)), "q4": rnd.choice(notes)}))

    # Absence alerts by SMS, as a school would set it up.
    settings = dict(school.settings or {})
    settings.setdefault("messaging", {"absent": ["sms"], "fee_reminder": ["sms", "whatsapp"]})
    school.settings = settings
    for i in range(6):
        db.add(MessageLog(school_id=school.id, channel="sms", to=f"+9198140{20000 + i:05d}", kind="absent", status="logged",
                          body="Your child was marked absent at school today. Please contact the class teacher if this is a mistake.",
                          created_at=datetime.now(UTC) - timedelta(days=i % 3, hours=i)))
    await db.flush()
    print(f"  Communication: PTM on {ptm_day:%d %b}, 1 chat, 1 survey with {len(families)} answers, SMS for absences")


async def seed_transport(db, school: School, today: date) -> None:
    from datetime import time as dtime
    from decimal import Decimal

    from app.models import Route, Stop, TransportAssignment, Vehicle
    if await db.scalar(select(Vehicle.id).where(Vehicle.school_id == school.id).limit(1)):
        return
    rnd = random.Random(151)
    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    plan = [
        ("PB01 AB 4521", "Tata Starbus 40", 40, "driver@demo.com", "Route 1 – Sector 21 & 22", 1500, [
            ("Sector 21 market", 30.7262, 76.7704, "07:15", "14:20"), ("Sector 22 B gurdwara", 30.7344, 76.7720, "07:22", "14:28"),
            ("ISBT 17", 30.7383, 76.7841, "07:30", "14:35"), ("Sector 18 park", 30.7290, 76.7898, "07:38", "14:42")]),
        ("CH01 TA 1180", "Eicher Skyline 32", 32, "driver2@demo.com", "Route 2 – Sector 34 & 35", 1500, [
            ("Sector 35 C market", 30.7238, 76.7600, "07:10", "14:15"), ("Sector 34 piccadily", 30.7230, 76.7678, "07:18", "14:23"),
            ("Sector 44 D", 30.7120, 76.7530, "07:28", "14:33")]),
        ("PB65 BB 2209", "Force Traveller 26", 26, "driver3@demo.com", "Route 3 – Mohali Phase 7", 1800, [
            ("Phase 7 market", 30.7046, 76.7179, "07:00", "14:30"), ("Phase 3B2", 30.7180, 76.7275, "07:12", "14:40"),
            ("Sector 70", 30.7056, 76.7036, "07:20", "14:48")]),
    ]
    students = list((await db.scalars(select(Student).where(Student.school_id == school.id, Student.status == "active")
                                      .order_by(Student.admission_no))).all())
    aarav = next((s for s in students if s.first_name == "Aarav" and s.last_name == "Patel"), None)
    pool = [s for s in students if s is not aarav]
    rnd.shuffle(pool)
    riders = 0
    for i, (number, model, cap, driver, rname, fee, stops) in enumerate(plan):
        d = users.get(driver)
        v = Vehicle(school_id=school.id, number=number, model=model, capacity=cap, driver_id=d.id if d else None, helper_name=["Rekha", "Shanti", "Kamla"][i],
                    helper_phone=f"+91 98150 4{i}210", insurance_until=today + timedelta(days=[200, 18, 340][i]),
                    fitness_until=today + timedelta(days=[120, 260, 25][i]), permit_until=today + timedelta(days=300))
        db.add(v)
        await db.flush()
        r = Route(school_id=school.id, name=rname, vehicle_id=v.id, monthly_fee=Decimal(fee))
        db.add(r)
        await db.flush()
        rows = []
        for j, (name, lat, lng, up, down) in enumerate(stops):
            st = Stop(school_id=school.id, route_id=r.id, name=name, sort_order=j, lat=lat, lng=lng,
                      pickup_time=dtime.fromisoformat(up), drop_time=dtime.fromisoformat(down))
            db.add(st)
            rows.append(st)
        await db.flush()
        take = [aarav] if i == 0 and aarav else []
        take += [pool.pop() for _ in range(min(len(pool), rnd.randint(14, 20)))]
        for s in take:
            db.add(TransportAssignment(school_id=school.id, student_id=s.id, route_id=r.id, stop_id=rnd.choice(rows).id))
            riders += 1
    await db.flush()
    print(f"  Transport: 3 buses and routes, {riders} riders (Aarav on Route 1)")
