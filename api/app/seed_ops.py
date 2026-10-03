"""Demo attendance history and fee records for the seeded school. Called from app.seed."""
import random
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.models import (
    AttendanceRecord, Exam, ExamMark, ExamPaper, ExamRemark, FeeCategory, FeeInvoice, FeeInvoiceItem, FeePayment, FeeStructure,
    Homework, HomeworkStatus, Notice, NoticeRead, School, SchoolClass, Section, Student, StudentGuardian, Subject, TimetableEntry, User,
)

HOLIDAYS = {date(2026, 8, 15), date(2026, 8, 28), date(2026, 10, 2)}  # Independence Day, Raksha Bandhan, Gandhi Jayanti

CATEGORIES = [  # (name, description)
    ("Tuition", "Teaching and classroom costs"),
    ("Development", "Buildings, furniture and smart classrooms"),
    ("Computer lab", "Computer lab and software"),
    ("Science lab", "Lab equipment and consumables"),
    ("Activities & sports", "Clubs, sports, excursions and events"),
]

# Fees per quarter by class group.
FEES = {
    "pre": {"Tuition": 7500, "Development": 1000, "Activities & sports": 1500},
    "primary": {"Tuition": 9000, "Development": 1500, "Computer lab": 1000, "Activities & sports": 1500},
    "middle": {"Tuition": 11000, "Development": 1500, "Computer lab": 1200, "Science lab": 1000, "Activities & sports": 1500},
    "board": {"Tuition": 12500, "Development": 1500, "Computer lab": 1200, "Science lab": 1200, "Activities & sports": 1500},
    "senior": {"Tuition": 15000, "Development": 2000, "Computer lab": 1500, "Science lab": 2000, "Activities & sports": 1500},
}

TERMS = [  # (name, issued, due)
    ("Quarter 1 (Apr–Jun) 2026-27", date(2026, 4, 1), date(2026, 4, 15)),
    ("Quarter 2 (Jul–Sep) 2026-27", date(2026, 7, 1), date(2026, 7, 15)),
    ("Quarter 3 (Oct–Dec) 2026-27", date(2026, 10, 1), date(2026, 10, 15)),
]


def fee_group(class_name: str) -> str:
    if class_name in ("Nursery", "LKG", "UKG"):
        return "pre"
    n = int(class_name.split()[1])
    return "primary" if n <= 5 else "middle" if n <= 8 else "board" if n <= 10 else "senior"


async def seed_attendance(db, school: School, today: date) -> None:
    if await db.scalar(select(AttendanceRecord.id).where(AttendanceRecord.school_id == school.id).limit(1)):
        return
    rnd = random.Random(7)
    sections = {s.id: s for s in (await db.scalars(select(Section).where(Section.school_id == school.id))).all()}
    students = (await db.scalars(select(Student).where(Student.school_id == school.id, Student.status == "active")
                                 .order_by(Student.admission_no))).all()
    # Most children attend well; a few have real problems worth spotting.
    likelihood = {}
    for st in students:
        likelihood[st.id] = 0.94 if st.last_name == "Patel" and st.first_name in ("Aarav", "Diya") else rnd.choice([0.62, 0.68, 0.71]) if rnd.random() < 0.05 else rnd.uniform(0.86, 0.99)
    days, d = [], date(2026, 7, 1)
    while d < today:
        if d.weekday() != 6 and d not in HOLIDAYS:
            days.append(d)
        d += timedelta(days=1)
    tz = ZoneInfo(school.timezone)
    rows = []
    for st in students:
        sec = sections[st.section_id]
        leave_days = set()
        if rnd.random() < 0.15:  # a family trip or illness
            start = rnd.randrange(len(days) - 3)
            leave_days = set(days[start:start + rnd.randint(2, 3)])
        for day in days:
            if day in leave_days:
                status = "leave"
            elif rnd.random() > likelihood[st.id]:
                status = "absent"
            else:
                r = rnd.random()
                status = "late" if r < 0.04 else "half_day" if r < 0.05 else "present"
            rows.append(AttendanceRecord(
                school_id=school.id, student_id=st.id, section_id=st.section_id, date=day, status=status,
                remark="Fever" if status == "absent" and rnd.random() < 0.15 else None, marked_by=sec.class_teacher_id,
                marked_at=datetime.combine(day, time(8, 10 + rnd.randint(0, 25)), tz)))
    db.add_all(rows)
    await db.flush()
    print(f"  Attendance: {len(rows)} records over {len(days)} school days (today is left for teachers to mark)")


async def seed_fees(db, school: School, today: date) -> None:
    if await db.scalar(select(FeeCategory.id).where(FeeCategory.school_id == school.id).limit(1)):
        return
    rnd = random.Random(11)
    tz = ZoneInfo(school.timezone)
    cats = {}
    for i, (name, desc) in enumerate(CATEGORIES, start=1):
        cats[name] = FeeCategory(school_id=school.id, name=name, description=desc, sort_order=i)
        db.add(cats[name])
    await db.flush()
    classes = (await db.scalars(select(SchoolClass).where(SchoolClass.school_id == school.id))).all()
    plan = {}
    for c in classes:
        plan[c.id] = FEES[fee_group(c.name)]
        db.add_all([FeeStructure(school_id=school.id, class_id=c.id, category_id=cats[n].id, amount=Decimal(a))
                    for n, a in plan[c.id].items()])

    staff = (await db.scalars(select(User.id).where(User.school_id == school.id, User.email.in_(["accounts@demo.com", "reception@demo.com"])))).all()
    guardians = defaultdict(list)
    for sid, uid in (await db.execute(select(StudentGuardian.student_id, StudentGuardian.user_id)
                                      .where(StudentGuardian.school_id == school.id))).all():
        guardians[sid].append(uid)
    students = (await db.scalars(select(Student).where(Student.school_id == school.id, Student.status == "active")
                                 .order_by(Student.admission_no))).all()
    # Brothers and sisters get a 10% tuition concession on the younger child.
    families = defaultdict(list)
    for st in students:
        for g in guardians[st.id][:1]:
            families[g].append(st)
    sibling_discount = {sorted(kids, key=lambda s: s.date_of_birth)[-1].id for kids in families.values() if len(kids) > 1}

    invoices, payments = [], []
    inv_seq = 0
    for term, issued, due in TERMS:
        if issued > today:
            continue
        for st in students:
            items = plan[st.class_id]
            total = Decimal(sum(items.values()))
            inv_seq += 1
            inv = FeeInvoice(school_id=school.id, invoice_no=f"INV-2627-{inv_seq:05d}", student_id=st.id, term=term,
                             academic_year="2026-27", issue_date=issued, due_date=due, total=total, discount=Decimal(0),
                             paid=Decimal(0), status="unpaid")
            if st.id in sibling_discount:
                inv.discount, inv.discount_reason = Decimal(items["Tuition"]) / 10, "Sibling concession (10% of tuition)"
            invoices.append((inv, items))
            net = inv.total - inv.discount
            # How the family pays this term.
            r = rnd.random()
            if st.first_name == "Aarav" and st.last_name == "Patel":
                plan_paid = net if term.startswith("Quarter 1") else (net - 3000 if term.startswith("Quarter 2") else Decimal(0))
            elif term.startswith("Quarter 1"):
                plan_paid = net if r < 0.97 else net / 2
            elif term.startswith("Quarter 2"):
                plan_paid = net if r < 0.84 else (net / 2 if r < 0.91 else Decimal(0))
            else:
                plan_paid = net if r < 0.22 else Decimal(0)
            if plan_paid <= 0:
                continue
            instalments = [plan_paid] if plan_paid < net or rnd.random() < 0.85 else [net / 2, net / 2]
            # Most pay within a few weeks; some only after reminders.
            window = 25 if rnd.random() < 0.7 else 85
            day = issued + timedelta(days=rnd.randint(0, min(window, (today - issued).days)))
            for amount in instalments:
                if day > today:  # the second instalment hasn't happened yet
                    break
                method = rnd.choices(["upi", "cash", "online", "cheque", "card"], [40, 25, 20, 10, 5])[0]
                online = method == "online"
                payments.append(dict(inv=inv, amount=amount.quantize(Decimal("1")), method=method,
                                     reference=None if method == "cash" else f"{method.upper()[:3]}{rnd.randint(100000, 999999)}",
                                     collected_by=None if online else rnd.choice(staff), paid_by=guardians[st.id][0] if online and guardians[st.id] else None,
                                     paid_at=datetime.combine(day, time(rnd.randint(9, 15), rnd.randint(0, 59)), tz)))
                day += timedelta(days=rnd.randint(20, 40))

    for inv, items in invoices:
        db.add(inv)
    await db.flush()
    for inv, items in invoices:
        db.add_all([FeeInvoiceItem(school_id=school.id, invoice_id=inv.id, category_id=cats[n].id, name=n, amount=Decimal(a))
                    for n, a in items.items()])
    for n, p in enumerate(sorted(payments, key=lambda x: x["paid_at"]), start=1):
        inv = p["inv"]
        db.add(FeePayment(school_id=school.id, receipt_no=f"RCT-2627-{n:05d}", invoice_id=inv.id, amount=p["amount"], method=p["method"],
                          reference=p["reference"], collected_by=p["collected_by"], paid_by=p["paid_by"], paid_at=p["paid_at"],
                          note="Paid online" if p["method"] == "online" else None))
        inv.paid += p["amount"]
    for inv, _ in invoices:
        bal = inv.total - inv.discount - inv.paid
        inv.status = "paid" if bal <= 0 else "partial" if inv.paid > 0 else "unpaid"
    await db.flush()
    print(f"  Fees: {len(invoices)} invoices across {len([t for t in TERMS if t[1] <= today])} terms, {len(payments)} payments")


# ---- exams, notices, homework --------------------------------------------------------------------

ACADEMIC = {"English", "Hindi", "Punjabi", "Mathematics", "EVS", "Science", "Social Science", "Computer Science", "Physics",
            "Chemistry", "Biology", "Accountancy", "Business Studies", "Economics"}

EXAMS = [  # (name, kind, start, end, max, pass, published)
    ("Unit Test 1", "unit_test", date(2026, 7, 20), date(2026, 7, 25), 25, 8, datetime(2026, 7, 31, 16, 0)),
    ("Half-Yearly", "term", date(2026, 9, 14), date(2026, 9, 25), 80, 27, datetime(2026, 10, 1, 17, 0)),
    ("Unit Test 2", "unit_test", date(2026, 11, 16), date(2026, 11, 21), 25, 8, None),
]

REMARKS = [
    (90, ["Outstanding performance. Keep it up!", "Excellent work across subjects. A pleasure to teach.", "Consistently brilliant. Well done!"]),
    (75, ["Very good progress. Aim higher in your weaker subjects.", "Sincere and hardworking. Keep going.", "Good effort; revise regularly to reach the top."]),
    (60, ["Good work. More practice will improve your scores.", "Shows interest in class. Needs to revise regularly.", "Steady progress. Focus on written answers."]),
    (45, ["Can do better with regular study.", "Needs to complete homework on time and revise daily.", "Must pay more attention in class."]),
    (0, ["Needs a lot of support. Please meet the class teacher.", "Requires regular practice at home. Parents please help.", "Has the ability but must work much harder."]),
]


def _school_days(start: date, end: date) -> list[date]:
    out, d = [], start
    while d <= end:
        if d.weekday() != 6 and d not in HOLIDAYS:
            out.append(d)
        d += timedelta(days=1)
    return out


async def seed_exams(db, school: School, today: date) -> None:
    if await db.scalar(select(Exam.id).where(Exam.school_id == school.id).limit(1)):
        return
    rnd = random.Random(23)
    tz = ZoneInfo(school.timezone)
    subjects = {s.id: s for s in (await db.scalars(select(Subject).where(Subject.school_id == school.id))).all()}
    classes = {c.id: c for c in (await db.scalars(select(SchoolClass).where(SchoolClass.school_id == school.id))).all()}
    sections = (await db.scalars(select(Section).where(Section.school_id == school.id))).all()
    teacher_of: dict[tuple, uuid.UUID] = {}
    class_subjects: dict[uuid.UUID, set] = defaultdict(set)
    sec_class = {s.id: s.class_id for s in sections}
    for sid, subj, tid in (await db.execute(select(TimetableEntry.section_id, TimetableEntry.subject_id, TimetableEntry.teacher_id)
                                            .where(TimetableEntry.school_id == school.id))).all():
        if subjects[subj].name in ACADEMIC and classes[sec_class[sid]].name not in ("Nursery", "LKG", "UKG"):
            class_subjects[sec_class[sid]].add(subj)
            if tid:
                teacher_of[(sid, subj)] = tid
    students = (await db.scalars(select(Student).where(Student.school_id == school.id, Student.status == "active"))).all()
    ability = {st.id: 0.86 if (st.first_name, st.last_name) == ("Aarav", "Patel") else 0.82 if (st.first_name, st.last_name) == ("Diya", "Patel")
               else min(0.97, max(0.3, rnd.gauss(0.68, 0.14))) for st in students}
    by_class = defaultdict(list)
    for st in students:
        by_class[st.class_id].append(st)
    class_teacher = {s.id: s.class_teacher_id for s in sections}

    n_marks = 0
    for name, kind, start, end, mx, ps, published in EXAMS:
        exam = Exam(school_id=school.id, name=name, kind=kind, academic_year="2026-27", start_date=start, end_date=end,
                    published_at=published.replace(tzinfo=tz) if published else None)
        db.add(exam)
        await db.flush()
        days = _school_days(start, end)
        for cid, subj_ids in class_subjects.items():
            ordered = sorted(subj_ids, key=lambda s: subjects[s].name)
            for i, sid in enumerate(ordered):
                paper = ExamPaper(school_id=school.id, exam_id=exam.id, class_id=cid, subject_id=sid, exam_date=days[i % len(days)],
                                  max_marks=Decimal(mx), pass_marks=Decimal(ps))
                db.add(paper)
                await db.flush()
                if end >= today:
                    continue  # not sat yet
                for st in by_class[cid]:
                    absent = rnd.random() < 0.01
                    score = min(1.0, max(0.0, ability[st.id] + rnd.uniform(-0.09, 0.09)))
                    db.add(ExamMark(school_id=school.id, paper_id=paper.id, student_id=st.id, absent=absent,
                                    marks=None if absent else Decimal(round(mx * score * 2) / 2),
                                    entered_by=teacher_of.get((st.section_id, sid)) or class_teacher.get(st.section_id),
                                    entered_at=datetime.combine(end + timedelta(days=rnd.randint(1, 4)), time(15, rnd.randint(0, 59)), tz)))
                    n_marks += 1
        if published and kind == "term":
            for cid in class_subjects:
                for st in by_class[cid]:
                    band = next(r for floor, r in REMARKS if ability[st.id] * 100 >= floor)
                    db.add(ExamRemark(school_id=school.id, exam_id=exam.id, student_id=st.id, remark=rnd.choice(band)))
    await db.flush()
    print(f"  Exams: {len(EXAMS)} exams, {n_marks} marks entered (Unit Test 1 and Half-Yearly published)")


NOTICES = [  # (days ago, title, body, audience, priority, pinned, author email)
    (1, "Diwali vacation", "School will remain closed from 20 to 25 October for Diwali. Classes resume on Monday, 26 October. Wishing all our families a happy and safe Diwali!", "everyone", "important", True, "principal@demo.com"),
    (2, "Half-Yearly results are out", "Report cards for the Half-Yearly exams are now available in the app. Parent–teacher meetings will be held on Saturday, 10 October from 9 am to 12 noon.", "families", "important", False, "admin@demo.com"),
    (3, "Quarter 3 fees due by 15 October", "Quarter 3 fees are due by 15 October. You can pay online in the EDUVIA app or at the school office (9 am to 1 pm). A late fee applies after the due date.", "families", "normal", False, "accounts@demo.com"),
    (4, "Staff meeting on Monday", "All teaching staff: a meeting on Monday at 2:15 pm in the conference room to plan Unit Test 2 and the annual day programme.", "staff", "normal", False, "principal@demo.com"),
    (6, "Annual Sports Day", "Our Annual Sports Day will be held on 14 November. Students should register for events with their PE teacher by 30 October.", "everyone", "normal", False, "admin@demo.com"),
    (8, "Science exhibition – Classes 6 to 10", "Students of Classes 6 to 10 can submit project ideas for the inter-school science exhibition to their science teacher by 15 October.", "sections:Class 6,Class 7,Class 8,Class 9,Class 10", "normal", False, "rajiv.menon@demo.com"),
    (10, "Board exam registration – Class 10 and 12", "Please verify your child's name, date of birth and subjects on the board registration form sent home today and return it signed by 9 October.", "sections:Class 10,Class 12", "urgent", False, "principal@demo.com"),
    (12, "Gandhi Jayanti holiday", "School will remain closed on Friday, 2 October for Gandhi Jayanti.", "everyone", "normal", False, "admin@demo.com"),
    (16, "Library week", "Library week runs from 21 to 26 September. Students can borrow two extra books during the week.", "families", "normal", False, "librarian@demo.com"),
    (20, "Uniform reminder", "Students must wear the winter uniform from 1 November. Uniforms are available at the school store.", "families", "normal", False, "reception@demo.com"),
]

HOMEWORK_TASKS = {
    "English": ["Read the next chapter and write a summary", "Write a paragraph on 'My favourite festival'", "Learn the new vocabulary words", "Complete the grammar worksheet on tenses"],
    "Hindi": ["पाठ पढ़ें और प्रश्नों के उत्तर लिखें", "सुलेख का एक पृष्ठ लिखें", "नए शब्दों के अर्थ याद करें"],
    "Punjabi": ["ਪਾਠ ਪੜ੍ਹੋ ਅਤੇ ਪ੍ਰਸ਼ਨ ਲਿਖੋ", "ਸੁੰਦਰ ਲਿਖਾਈ ਦਾ ਇੱਕ ਪੰਨਾ"],
    "Mathematics": ["Exercise {n}, questions 1–10", "Practice sums from the worksheet", "Revise tables 2 to 12", "Solve the word problems on page {p}"],
    "EVS": ["Draw and label the parts of a plant", "Collect five different leaves and paste them", "Write five lines on saving water"],
    "Science": ["Answer the questions at the end of the chapter", "Draw a labelled diagram of the experiment", "Revise the chapter for a class test"],
    "Social Science": ["Learn the map work for the chapter", "Answer the long questions in the notebook", "Make a timeline of the events"],
    "Computer Science": ["Practise the program from class", "Write the steps to create a folder", "Revise the shortcuts"],
    "Physics": ["Solve the numericals from exercise {n}", "Derive the formula done in class"],
    "Chemistry": ["Balance the equations in the worksheet", "Learn the periodic table for the first 20 elements"],
    "Biology": ["Draw a labelled diagram of the cell", "Answer the NCERT questions"],
    "Accountancy": ["Prepare the journal entries for question {n}", "Post the entries to the ledger"],
    "Business Studies": ["Answer the case study questions", "Revise the principles of management"],
    "Economics": ["Prepare a frequency table from the data", "Answer the short questions"],
}


async def seed_notices_homework(db, school: School, today: date) -> None:
    if await db.scalar(select(Notice.id).where(Notice.school_id == school.id).limit(1)):
        return
    rnd = random.Random(31)
    tz = ZoneInfo(school.timezone)
    users = {u.email: u for u in (await db.scalars(select(User).where(User.school_id == school.id))).all()}
    sections = (await db.execute(select(Section, SchoolClass.name).join(SchoolClass, SchoolClass.id == Section.class_id)
                                 .where(Section.school_id == school.id))).all()
    families = [u for u in users.values() if u.role in ("parent", "student")]
    for ago, title, body, audience, priority, pinned, author in NOTICES:
        section_ids = []
        if audience.startswith("sections:"):
            wanted = set(audience.split(":", 1)[1].split(","))
            section_ids = [s.id for s, cname in sections if cname in wanted]
            audience = "sections"
        created = datetime.combine(today - timedelta(days=ago), time(rnd.randint(8, 16), rnd.randint(0, 59)), tz)
        n = Notice(school_id=school.id, title=title, body=body, audience=audience, section_ids=section_ids, priority=priority,
                   pinned=pinned, created_by=users[author].id if author in users else None, created_at=created, updated_at=created)
        db.add(n)
        await db.flush()
        # Older notices have been read by more people; the Patels haven't seen the two newest.
        readers = [u for u in families if rnd.random() < min(0.9, 0.25 + ago * 0.06)]
        readers += [u for u in users.values() if u.role not in ("parent", "student") and rnd.random() < 0.7]
        for u in readers:
            if ago <= 2 and u.email in ("parent@demo.com", "mother@demo.com", "student@demo.com"):
                continue
            db.add(NoticeRead(school_id=school.id, notice_id=n.id, user_id=u.id, read_at=created + timedelta(hours=rnd.randint(1, 30))))

    # Homework for the last two weeks and the next few days.
    subjects = {s.id: s for s in (await db.scalars(select(Subject).where(Subject.school_id == school.id))).all()}
    lessons = defaultdict(list)  # (section, weekday) -> [(subject, teacher)]
    for sid, day, subj, tid in (await db.execute(select(TimetableEntry.section_id, TimetableEntry.day, TimetableEntry.subject_id, TimetableEntry.teacher_id)
                                                  .where(TimetableEntry.school_id == school.id))).all():
        if subjects[subj].name in HOMEWORK_TASKS:
            lessons[(sid, day)].append((subj, tid))
    students = defaultdict(list)
    for st in (await db.scalars(select(Student).where(Student.school_id == school.id, Student.status == "active"))).all():
        students[st.section_id].append(st)
    days = _school_days(today - timedelta(days=16), today)
    hw_count = st_count = 0
    for s, cname in sections:
        if cname in ("Nursery", "LKG", "UKG"):
            continue
        for d in days:
            todays = list({subj: tid for subj, tid in lessons[(s.id, d.isoweekday())]}.items())
            for subj, tid in rnd.sample(todays, min(2, len(todays))):
                due = d + timedelta(days=rnd.choice([1, 2, 2, 3]))
                due += timedelta(days=1) if due.weekday() == 6 else timedelta(0)
                task = rnd.choice(HOMEWORK_TASKS[subjects[subj].name]).format(n=f"{rnd.randint(2, 9)}.{rnd.randint(1, 4)}", p=rnd.randint(20, 140))
                h = Homework(school_id=school.id, section_id=s.id, subject_id=subj, title=task, details=None, assigned_on=d, due_date=due,
                             created_by=tid, created_at=datetime.combine(d, time(13, 30), tz), updated_at=datetime.combine(d, time(13, 30), tz))
                db.add(h)
                await db.flush()
                hw_count += 1
                for st in students[s.id]:
                    r = rnd.random()
                    if due < today:
                        status = "checked" if r < 0.8 else "incomplete" if r < 0.9 else None
                    else:
                        status = "done" if r < 0.3 else None
                    if status:
                        db.add(HomeworkStatus(school_id=school.id, homework_id=h.id, student_id=st.id, status=status,
                                              remark="Incomplete – please finish and show" if status == "incomplete" else None,
                                              updated_at=datetime.combine(min(due, today), time(12, 0), tz)))
                        st_count += 1
    await db.flush()
    print(f"  Notices: {len(NOTICES)}; homework: {hw_count} pieces, {st_count} student statuses")
