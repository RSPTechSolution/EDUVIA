"""Demo attendance history and fee records for the seeded school. Called from app.seed."""
import random
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.models import (
    AttendanceRecord, FeeCategory, FeeInvoice, FeeInvoiceItem, FeePayment, FeeStructure, School, SchoolClass, Section,
    Student, StudentGuardian, User,
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
