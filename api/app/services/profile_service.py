"""Everything about one person across the modules: what a student has borrowed, where they stay, how they get to school,
their results, homework, requests and certificates; and for staff, parents and drivers, what they look after.

Each section is filled only when the school uses that module. Helpers here are shared by the student profile and
by user detail pages (including a person's own profile)."""
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import enabled_modules
from app.core.errors import NotFound
from app.models import (
    Book, BookCopy, BookIssue, Certificate, Exam, ExamMark, ExamPaper, GatePass, Homework, HomeworkStatus,
    Hostel, HostelAllocation, HostelRoom, LeaveRequest, LessonPlan, LiveClass, OnlineTest, PayrollRun, Payslip, PtmBooking,
    PtmEvent, Route, SchoolClass, Section, StaffAttendance, StaffLeave, StaffProfile, Stop, Student, StudentGuardian,
    Substitution, TestAttempt, TransportAssignment, Trip, User, Vehicle, Visitor,
)
from app.schemas.profile import (
    BusDuty, BusSummary, CertificateRow, ExamResult, HomeworkSummary, HostelStay, HrSummary, LibrarySummary,
    LiveClassRow, LoanRow, PtmRow, RequestRow, Sibling, StudentOverview, TestRow, TripRow, VisitorRow,
)
from app.schemas.profile import Payslip as PayslipOut
from app.services.family_service import school_today

ZERO = Decimal(0)


# ---- shared ---------------------------------------------------------------------------------

async def library_summary(db: AsyncSession, *, student_id: uuid.UUID | None = None, user_id: uuid.UUID | None = None) -> LibrarySummary:
    """Books on loan now, the last few returned, and unpaid fines, for a student or a staff member."""
    who = BookIssue.student_id == student_id if student_id else BookIssue.user_id == user_id
    rows = (await db.execute(
        select(BookIssue, Book.title, Book.author, BookCopy.accession_no)
        .join(BookCopy, BookCopy.id == BookIssue.copy_id).join(Book, Book.id == BookCopy.book_id)
        .where(who).order_by(BookIssue.issued_on.desc()))).all()
    today = date.today()

    def row(i: BookIssue, title: str, author: str | None, acc: str) -> LoanRow:
        return LoanRow(title=title, author=author, accession_no=acc, issued_on=i.issued_on, due_on=i.due_on, returned_on=i.returned_on,
                       overdue=i.returned_on is None and i.due_on < today, fine=i.fine or ZERO)

    current = [row(*r) for r in rows if r[0].returned_on is None]
    returned = [row(*r) for r in rows if r[0].returned_on is not None]
    fines = sum((r[0].fine or ZERO for r in rows if not r[0].fine_paid), ZERO)
    return LibrarySummary(current=current, recent_returns=returned[:3], returned_total=len(returned), fines_due=fines)


def _labels(rows) -> dict[uuid.UUID, str]:
    return {sid: f"{c} – {n}" for sid, c, n in rows}


async def section_labels(db: AsyncSession, school_id: uuid.UUID) -> dict[uuid.UUID, str]:
    return _labels((await db.execute(select(Section.id, SchoolClass.name, Section.name).join(SchoolClass, SchoolClass.id == Section.class_id)
                                     .where(Section.school_id == school_id))).all())


async def student_requests(db: AsyncSession, student_ids: list[uuid.UUID], names: dict[uuid.UUID, str], *, modules: list[str],
                           limit: int = 6) -> list[RequestRow]:
    """Recent leave requests and gate passes for these students, newest first."""
    out: list[RequestRow] = []
    if not student_ids:
        return out
    if "attendance" in modules:
        for r in (await db.scalars(select(LeaveRequest).where(LeaveRequest.student_id.in_(student_ids))
                                   .order_by(LeaveRequest.from_date.desc()).limit(limit))).all():
            span = r.from_date.strftime("%d %b") + ("" if r.to_date == r.from_date else f" – {r.to_date.strftime('%d %b')}")
            out.append(RequestRow(kind="leave", title=f"Leave ({r.kind})", detail=f"{span} · {r.reason}", status=r.status, on=r.from_date,
                                  student_id=r.student_id, student_name=names.get(r.student_id)))
    if "security" in modules:
        for g in (await db.scalars(select(GatePass).where(GatePass.student_id.in_(student_ids))
                                   .order_by(GatePass.leave_at.desc()).limit(limit))).all():
            out.append(RequestRow(kind="gate_pass", title="Gate pass", detail=f"{g.reason} · picked up by {g.pickup_name} ({g.pickup_relation})",
                                  status=g.status, on=g.leave_at.date(), student_id=g.student_id, student_name=names.get(g.student_id)))
    return sorted(out, key=lambda r: r.on, reverse=True)[:limit]


async def ptm_rows(db: AsyncSession, *, student_ids: list[uuid.UUID] | None = None, teacher_id: uuid.UUID | None = None,
                   names: dict[uuid.UUID, str] | None = None) -> list[PtmRow]:
    """Parent-teacher meeting bookings from today on."""
    q = (select(PtmBooking, PtmEvent.title, PtmEvent.date, User.full_name).join(PtmEvent, PtmEvent.id == PtmBooking.event_id)
         .join(User, User.id == PtmBooking.teacher_id, isouter=True).where(PtmEvent.date >= date.today()))
    q = q.where(PtmBooking.student_id.in_(student_ids)) if student_ids is not None else q.where(PtmBooking.teacher_id == teacher_id)
    rows = (await db.execute(q.order_by(PtmEvent.date, PtmBooking.slot).limit(10))).all()
    names = names or {}
    if teacher_id and rows:
        ids = {b.student_id for b, *_ in rows}
        names = {s.id: f"{s.first_name} {s.last_name}" for s in (await db.scalars(select(Student).where(Student.id.in_(ids)))).all()}
    return [PtmRow(title=t, on=d, slot=b.slot.strftime("%H:%M"), teacher_name=tn, student_name=names.get(b.student_id)) for b, t, d, tn in rows]


# ---- students -------------------------------------------------------------------------------

async def student_overview(db: AsyncSession, school_id: uuid.UUID, student_id: uuid.UUID) -> StudentOverview:
    st = await db.scalar(select(Student).where(Student.id == student_id, Student.school_id == school_id))
    if not st:
        raise NotFound("Student not found")
    modules = await enabled_modules(db, school_id)
    today = await school_today(db, school_id)
    out = StudentOverview()
    name = {st.id: f"{st.first_name} {st.last_name}"}

    if "library" in modules:
        out.library = await library_summary(db, student_id=st.id)

    if "hostel" in modules:
        row = (await db.execute(select(HostelAllocation, HostelRoom, Hostel).join(HostelRoom, HostelRoom.id == HostelAllocation.room_id)
                                .join(Hostel, Hostel.id == HostelRoom.hostel_id)
                                .where(HostelAllocation.student_id == st.id, HostelAllocation.left_on.is_(None)))).first()
        if row:
            a, room, h = row
            out.hostel = HostelStay(hostel=h.name, room=room.number, floor=room.floor, since=a.from_date)

    if "transport" in modules:
        row = (await db.execute(select(TransportAssignment, Route, Stop).join(Route, Route.id == TransportAssignment.route_id)
                                .join(Stop, Stop.id == TransportAssignment.stop_id, isouter=True)
                                .where(TransportAssignment.student_id == st.id))).first()
        if row:
            _, route, stop = row
            v = await db.get(Vehicle, route.vehicle_id) if route.vehicle_id else None
            driver = await db.get(User, v.driver_id) if v and v.driver_id else None
            out.bus = BusSummary(route=route.name, stop=stop.name if stop else None,
                                 pickup_time=stop.pickup_time.strftime("%H:%M") if stop and stop.pickup_time else None,
                                 drop_time=stop.drop_time.strftime("%H:%M") if stop and stop.drop_time else None,
                                 vehicle_number=v.number if v else None, driver_name=driver.full_name if driver else None,
                                 driver_phone=driver.phone if driver else None)

    if "exams" in modules:
        rows = (await db.execute(
            select(Exam.id, Exam.name, func.max(Exam.start_date), func.count(ExamMark.id), func.count().filter(ExamMark.absent.is_(True)),
                   func.sum(ExamMark.marks).filter(ExamMark.absent.is_(False), ExamMark.marks.is_not(None)),
                   func.sum(ExamPaper.max_marks).filter(ExamMark.absent.is_(False), ExamMark.marks.is_not(None)))
            .select_from(ExamMark).join(ExamPaper, ExamPaper.id == ExamMark.paper_id).join(Exam, Exam.id == ExamPaper.exam_id)
            .where(ExamMark.student_id == st.id, Exam.published_at.is_not(None))
            .group_by(Exam.id, Exam.name).order_by(func.max(Exam.start_date).desc().nulls_last()).limit(5))).all()
        out.results = [ExamResult(exam_id=eid, name=n, papers=papers, absent=int(absent or 0),
                                  percent=round(float(got) * 100 / float(mx), 1) if got is not None and mx else None)
                       for eid, n, _, papers, absent, got, mx in rows]
        out.tests = [TestRow(title=t, score=a.score, submitted_at=a.submitted_at, needs_marking=a.needs_marking) for a, t in (await db.execute(
            select(TestAttempt, OnlineTest.title).join(OnlineTest, OnlineTest.id == TestAttempt.test_id)
            .where(TestAttempt.student_id == st.id).order_by(TestAttempt.started_at.desc()).limit(5))).all()]

    if "academics" in modules:
        hw = (await db.execute(select(Homework.id, Homework.due_date).where(Homework.section_id == st.section_id))).all()
        statuses = dict((await db.execute(select(HomeworkStatus.homework_id, HomeworkStatus.status)
                                          .where(HomeworkStatus.student_id == st.id, HomeworkStatus.homework_id.in_([h for h, _ in hw])))).all()) if hw else {}
        c: Counter = Counter()
        for hid, due in hw:
            s = statuses.get(hid, "pending")
            if s in ("pending", "incomplete"):
                c["overdue" if due < today else "pending"] += 1
            else:
                c[s] += 1
        out.homework = HomeworkSummary(pending=c["pending"], overdue=c["overdue"], done=c["done"], checked=c["checked"])

    out.requests = await student_requests(db, [st.id], name, modules=modules)

    if "students" in modules:
        out.certificates = [CertificateRow(kind=x.kind, serial_no=x.serial_no, issued_on=x.issued_on) for x in (await db.scalars(
            select(Certificate).where(Certificate.student_id == st.id, Certificate.cancelled_at.is_(None)).order_by(Certificate.issued_on.desc()))).all()]

    if "communication" in modules:
        out.ptm = await ptm_rows(db, student_ids=[st.id], names=name)

    guardians = select(StudentGuardian.user_id).where(StudentGuardian.student_id == st.id)
    sib = (await db.execute(
        select(Student, SchoolClass.name, Section.name).distinct().join(StudentGuardian, StudentGuardian.student_id == Student.id)
        .join(SchoolClass, SchoolClass.id == Student.class_id).join(Section, Section.id == Student.section_id)
        .where(StudentGuardian.user_id.in_(guardians), Student.id != st.id, Student.status == "active"))).all()
    out.siblings = [Sibling(student_id=s.id, name=f"{s.first_name} {s.last_name}", class_section=f"{c} – {n}") for s, c, n in sib]
    return out


# ---- staff, parents and drivers -------------------------------------------------------------

async def hr_summary(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> HrSummary:
    today = await school_today(db, school_id)
    month_start = today.replace(day=1)
    prof = await db.scalar(select(StaffProfile).where(StaffProfile.user_id == user_id))
    days = Counter(dict((await db.execute(select(StaffAttendance.status, func.count()).where(
        StaffAttendance.user_id == user_id, StaffAttendance.date.between(month_start, today)).group_by(StaffAttendance.status))).all()))
    leave_days = await db.scalar(select(func.coalesce(func.sum(StaffLeave.days), 0)).where(
        StaffLeave.user_id == user_id, StaffLeave.status == "approved", StaffLeave.from_date <= today, StaffLeave.to_date >= month_start))
    requests = [RequestRow(kind="staff_leave", title="Leave", detail=f"{lv.from_date.strftime('%d %b')}"
                           + ("" if lv.to_date == lv.from_date else f" – {lv.to_date.strftime('%d %b')}") + f" · {lv.reason}",
                           status=lv.status, on=lv.from_date)
                for lv in (await db.scalars(select(StaffLeave).where(StaffLeave.user_id == user_id).order_by(StaffLeave.from_date.desc()).limit(5))).all()]
    slip = (await db.execute(select(Payslip.net, PayrollRun.month).join(PayrollRun, PayrollRun.id == Payslip.run_id)
                             .where(Payslip.user_id == user_id, PayrollRun.status != "draft").order_by(PayrollRun.month.desc()).limit(1))).first()
    return HrSummary(department=prof.department if prof else None, joined_on=prof.date_of_joining if prof else None,
                     qualification=prof.qualification if prof else None, present_days=days["present"] + days["late"] + days["half_day"],
                     absent_days=days["absent"], leave_days=Decimal(leave_days or 0), requests=requests,
                     latest_payslip=PayslipOut(month=slip[1], net=slip[0]) if slip else None)


async def section_sizes(db: AsyncSession, section_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not section_ids:
        return {}
    return dict((await db.execute(select(Student.section_id, func.count()).where(Student.section_id.in_(section_ids), Student.status == "active")
                                  .group_by(Student.section_id))).all())


async def driver_duties(db: AsyncSession, user_id: uuid.UUID) -> tuple[list[BusDuty], list[TripRow]]:
    vehicles = (await db.scalars(select(Vehicle).where(Vehicle.driver_id == user_id, Vehicle.is_active.is_(True)))).all()
    duties = []
    for v in vehicles:
        routes = (await db.scalars(select(Route.name).where(Route.vehicle_id == v.id, Route.is_active.is_(True)).order_by(Route.name))).all()
        duties.append(BusDuty(vehicle_number=v.number, routes=list(routes), helper=v.helper_name))
    trips = [TripRow(route=rn, direction=t.direction, status=t.status, started_at=t.started_at, ended_at=t.ended_at) for t, rn in (await db.execute(
        select(Trip, Route.name).join(Route, Route.id == Trip.route_id).where(Trip.driver_id == user_id).order_by(Trip.started_at.desc()).limit(5))).all()]
    return duties, trips


async def teacher_extras(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    """Upcoming live classes, this week's lesson plans and cover periods."""
    labels = await section_labels(db, school_id)
    now = datetime.now().astimezone()
    live = [LiveClassRow(title=lc.title, starts_at=lc.starts_at, sections=[labels.get(s, "") for s in lc.section_ids]) for lc in (await db.scalars(
        select(LiveClass).where(LiveClass.teacher_id == user_id, LiveClass.cancelled.is_(False), LiveClass.starts_at >= now - timedelta(hours=1))
        .order_by(LiveClass.starts_at).limit(5))).all()]
    today = await school_today(db, school_id)
    week = today - timedelta(days=today.weekday())
    plans = await db.scalar(select(func.count()).select_from(LessonPlan).where(LessonPlan.teacher_id == user_id,
                                                                                LessonPlan.date.between(week, week + timedelta(days=6))))
    covers = await db.scalar(select(func.count()).select_from(Substitution).where(Substitution.substitute_id == user_id, Substitution.date >= today))
    return {"live_classes": live, "lesson_plans_this_week": plans or 0, "covers_ahead": covers or 0}


async def visitors_hosted(db: AsyncSession, user_id: uuid.UUID) -> list[VisitorRow]:
    return [VisitorRow(name=v.name, purpose=v.purpose, status=v.status, on=v.in_at or v.expected_on) for v in (await db.scalars(
        select(Visitor).where(Visitor.host_id == user_id).order_by(func.coalesce(Visitor.in_at, Visitor.created_at).desc()).limit(5))).all()]


async def warden_of(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    return list((await db.scalars(select(Hostel.name).where(Hostel.warden_id == user_id).order_by(Hostel.name))).all())
