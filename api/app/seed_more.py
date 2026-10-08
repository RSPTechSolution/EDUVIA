"""Demo data for syllabus, lesson plans, admission enquiries, certificates and substitutions. Called from app.seed."""
import random
from datetime import UTC, date, datetime, timedelta

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
