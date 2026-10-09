"""School analytics: enrolment, attendance, fees, exam results, and students who need attention."""
import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AttendanceRecord, Exam, ExamMark, ExamPaper, FeeInvoice, FeePayment, School, SchoolClass, Section, Student, Subject, User
from app.schemas.analytics import (
    AgingBucket, AnalyticsReport, AtRisk, ClassAttendance, ClassEnrolment, ClassResult, Defaulter, ExamSummary, FeeSummary, MonthAmount,
    SubjectResult, TrendPoint,
)
from app.services.attendance_service import LOW_ATTENDANCE, academic_year_start
from app.services.family_service import school_today
from app.services.fee_service import academic_year

ZERO = Decimal(0)
PASS_PERCENT = 33.0


def _pct(num: float, den: float) -> float | None:
    return round(100 * num / den, 1) if den else None


def _attended():
    """SQL: attended days (late = present, half day = half) and countable days (leave excluded)."""
    s = AttendanceRecord.status
    attended = func.sum(case((s.in_(("present", "late")), 1.0), (s == "half_day", 0.5), else_=0.0))
    days = func.sum(case((s == "leave", 0), else_=1))
    return attended, days


async def report(db: AsyncSession, user: User, frm: date | None = None, to: date | None = None) -> AnalyticsReport:
    sid = user.school_id
    today = await school_today(db, sid)
    to = to or today
    frm = frm or max(academic_year_start(to), to - timedelta(days=89))
    year = academic_year(today)

    classes = (await db.execute(select(SchoolClass.id, SchoolClass.name).where(SchoolClass.school_id == sid).order_by(SchoolClass.sort_order))).all()
    class_name = dict(classes)

    # ---- enrolment
    rows = (await db.execute(select(Student.class_id, Student.gender, func.count()).where(Student.school_id == sid, Student.status == "active")
                             .group_by(Student.class_id, Student.gender))).all()
    by_class: dict[uuid.UUID, ClassEnrolment] = {cid: ClassEnrolment(class_id=cid, name=n, students=0, boys=0, girls=0) for cid, n in classes}
    for cid, gender, n in rows:
        e = by_class.get(cid)
        if not e:
            continue
        e.students += n
        if gender == "male":
            e.boys += n
        elif gender == "female":
            e.girls += n
    total_students = sum(e.students for e in by_class.values())
    new_admissions = await db.scalar(select(func.count()).select_from(Student).where(
        Student.school_id == sid, Student.status == "active", Student.admission_date >= academic_year_start(today))) or 0

    # ---- attendance
    attended, days = _attended()
    in_range = (AttendanceRecord.school_id == sid, AttendanceRecord.date.between(frm, to))
    a, d = (await db.execute(select(attended, days).where(*in_range))).one()
    trend = [TrendPoint(date=day, percent=_pct(float(x or 0), float(y or 0)))
             for day, x, y in (await db.execute(select(AttendanceRecord.date, attended, days).where(*in_range)
                                                .group_by(AttendanceRecord.date).order_by(AttendanceRecord.date))).all()]
    per_class = (await db.execute(select(Student.class_id, attended, days).join(Student, Student.id == AttendanceRecord.student_id)
                                  .where(*in_range).group_by(Student.class_id))).all()
    class_att = sorted((ClassAttendance(class_id=cid, name=class_name.get(cid, ""), percent=_pct(float(x or 0), float(y or 0))) for cid, x, y in per_class),
                       key=lambda c: list(class_name).index(c.class_id) if c.class_id in class_name else 999)
    per_student = {sid_: (float(x or 0), float(y or 0)) for sid_, x, y in (await db.execute(
        select(AttendanceRecord.student_id, attended, days).where(*in_range).group_by(AttendanceRecord.student_id))).all()}
    low_att = {s: _pct(x, y) for s, (x, y) in per_student.items() if y >= 10 and (_pct(x, y) or 100) < LOW_ATTENDANCE}

    # ---- fees (this academic year)
    inv = (await db.execute(select(func.coalesce(func.sum(FeeInvoice.total - FeeInvoice.discount), 0), func.coalesce(func.sum(FeeInvoice.paid), 0))
                            .where(FeeInvoice.school_id == sid, FeeInvoice.academic_year == year, FeeInvoice.status != "cancelled"))).one()
    billed, collected = Decimal(inv[0]), Decimal(inv[1])
    tz = await db.scalar(select(School.timezone).where(School.id == sid)) or "Asia/Kolkata"
    local = func.timezone(tz, FeePayment.paid_at)
    month = func.to_char(local, literal_column("'YYYY-MM'"))
    since = date(today.year - 1, today.month, 1) + timedelta(days=31)
    since = date(since.year, since.month, 1)
    monthly = {m: Decimal(v) for m, v in (await db.execute(select(month, func.sum(FeePayment.amount)).where(FeePayment.school_id == sid, local >= since)
                                                            .group_by(month))).all()}
    months = []
    y_, m_ = since.year, since.month
    while (y_, m_) <= (today.year, today.month):
        key = f"{y_}-{m_:02d}"
        months.append(MonthAmount(month=key, amount=monthly.get(key, ZERO)))
        y_, m_ = (y_ + 1, 1) if m_ == 12 else (y_, m_ + 1)
    open_inv = (await db.execute(select(FeeInvoice.student_id, FeeInvoice.due_date, FeeInvoice.total - FeeInvoice.discount - FeeInvoice.paid)
                                 .where(FeeInvoice.school_id == sid, FeeInvoice.status.in_(("unpaid", "partial"))))).all()
    buckets = {"Not due yet": ZERO, "1–30 days": ZERO, "31–60 days": ZERO, "61–90 days": ZERO, "Over 90 days": ZERO}
    owed: dict[uuid.UUID, Decimal] = defaultdict(lambda: ZERO)
    oldest: dict[uuid.UUID, int] = {}
    for stid, due, bal in open_inv:
        bal = max(Decimal(bal), ZERO)
        if not bal:
            continue
        late = (today - due).days
        key = "Not due yet" if late <= 0 else "1–30 days" if late <= 30 else "31–60 days" if late <= 60 else "61–90 days" if late <= 90 else "Over 90 days"
        buckets[key] += bal
        if late > 0:
            owed[stid] += bal
            oldest[stid] = max(oldest.get(stid, 0), late)

    # ---- the latest published exam
    exam = await db.scalar(select(Exam).where(Exam.school_id == sid, Exam.published_at.isnot(None)).order_by(Exam.published_at.desc()).limit(1))
    exam_summary = None
    failed: dict[uuid.UUID, int] = defaultdict(int)
    if exam:
        marks = (await db.execute(select(ExamMark.student_id, ExamMark.marks, ExamMark.absent, ExamPaper.max_marks, ExamPaper.pass_marks,
                                         ExamPaper.class_id, Subject.name)
                                  .join(ExamPaper, ExamPaper.id == ExamMark.paper_id).join(Subject, Subject.id == ExamPaper.subject_id)
                                  .where(ExamPaper.exam_id == exam.id))).all()
        stu_tot: dict[uuid.UUID, list[float]] = defaultdict(lambda: [0.0, 0.0])
        stu_class: dict[uuid.UUID, uuid.UUID] = {}
        subj: dict[str, list[float]] = defaultdict(list)
        for stid, mk, absent, mx, pm, cid, sname in marks:
            got = 0.0 if absent or mk is None else float(mk)
            stu_tot[stid][0] += got
            stu_tot[stid][1] += float(mx)
            stu_class[stid] = cid
            subj[sname].append(100 * got / float(mx) if mx else 0)
            if absent or mk is None or mk < pm:
                failed[stid] += 1
        cls: dict[uuid.UUID, list[float]] = defaultdict(list)
        for stid, (g, m) in stu_tot.items():
            if m:
                cls[stu_class[stid]].append(100 * g / m)
        class_results = [ClassResult(class_id=cid, name=n, students=len(cls[cid]), average=round(sum(cls[cid]) / len(cls[cid]), 1),
                                     pass_rate=_pct(sum(1 for s in stu_class if stu_class[s] == cid and not failed.get(s)), len(cls[cid])))
                         for cid, n in classes if cls.get(cid)]
        exam_summary = ExamSummary(
            exam_id=exam.id, name=exam.name, classes=class_results,
            subjects=sorted((SubjectResult(name=k, average=round(sum(v) / len(v), 1)) for k, v in subj.items() if v), key=lambda s: s.average),
            pass_rate=_pct(sum(1 for s in stu_tot if not failed.get(s)), len(stu_tot)))

    # ---- students who need attention
    risky = set(low_att) | {s for s, n in failed.items() if n} | {s for s, days_ in oldest.items() if days_ > 60}
    at_risk: list[AtRisk] = []
    if risky:
        info = (await db.execute(select(Student.id, Student.first_name, Student.last_name, Student.admission_no, SchoolClass.name, Section.name)
                                 .join(SchoolClass, SchoolClass.id == Student.class_id).join(Section, Section.id == Student.section_id)
                                 .where(Student.id.in_(risky), Student.status == "active"))).all()
        for stid, fn, ln, adm, cn, sn in info:
            reasons = []
            if stid in low_att:
                reasons.append(f"Attendance {low_att[stid]}%")
            if failed.get(stid):
                reasons.append(f"Below pass mark in {failed[stid]} paper{'s' if failed[stid] > 1 else ''}")
            if oldest.get(stid, 0) > 60:
                reasons.append(f"Fees overdue {oldest[stid]} days")
            at_risk.append(AtRisk(student_id=stid, name=f"{fn} {ln}", admission_no=adm, class_section=f"{cn} – {sn}", reasons=reasons))
        at_risk.sort(key=lambda r: (-len(r.reasons), r.class_section, r.name))

    defaulters = []
    if owed:
        top = sorted(owed.items(), key=lambda kv: -kv[1])[:10]
        names = {i: (f"{f} {lname}", f"{c} – {s}") for i, f, lname, c, s in (await db.execute(
            select(Student.id, Student.first_name, Student.last_name, SchoolClass.name, Section.name)
            .join(SchoolClass, SchoolClass.id == Student.class_id).join(Section, Section.id == Student.section_id)
            .where(Student.id.in_([k for k, _ in top])))).all()}
        defaulters = [Defaulter(student_id=k, name=names[k][0], class_section=names[k][1], balance=v, days_overdue=oldest[k]) for k, v in top if k in names]

    return AnalyticsReport(
        frm=frm, to=to, academic_year=year, students=total_students, new_admissions=new_admissions,
        enrolment=[e for e in by_class.values() if e.students],
        attendance_percent=_pct(float(a or 0), float(d or 0)), attendance_trend=trend, class_attendance=class_att, low_attendance=len(low_att),
        fees=FeeSummary(billed=billed, collected=collected, outstanding=max(billed - collected, ZERO), collection_percent=_pct(float(collected), float(billed)),
                        monthly=months, aging=[AgingBucket(label=k, amount=v) for k, v in buckets.items()], defaulters=defaulters),
        exam=exam_summary, at_risk=at_risk[:100], at_risk_total=len(at_risk))
