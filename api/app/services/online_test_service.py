"""Question bank and online tests: teachers build tests from questions; students take them in a time window;
choice questions are marked automatically and short answers by the teacher."""
import random
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Forbidden, NotFound
from app.models import OnlineTest, Question, Section, Student, Subject, TestAttempt, User
from app.schemas.online import (
    AttemptResult, AttemptRow, AttemptView, MyTest, PaperQuestion, QuestionIn, QuestionOut, QuestionStat, ResultQuestion, TestIn,
    TestOut, TestResults,
)
from app.services import audit_service, notification_service
from app.services.academics_service import field_error, get_class
from app.services.family_service import own_students
from app.services.homework_service import _allowed, _labels, _scope

GRACE = timedelta(seconds=60)  # network delays at the deadline


def _now() -> datetime:
    return datetime.now(UTC)


async def _class_sections(db: AsyncSession, class_id: uuid.UUID) -> list[uuid.UUID]:
    return list((await db.scalars(select(Section.id).where(Section.class_id == class_id))).all())


async def _may_teach(db: AsyncSession, user: User, scope, class_id: uuid.UUID, subject_id: uuid.UUID) -> bool:
    return scope is None or any(_allowed(scope, s, subject_id) for s in await _class_sections(db, class_id))


async def _subject(db: AsyncSession, school_id: uuid.UUID, subject_id: uuid.UUID) -> Subject:
    s = await db.scalar(select(Subject).where(Subject.id == subject_id, Subject.school_id == school_id))
    if not s:
        raise field_error("subject_id", "Choose a subject from your school")
    return s


# ---- question bank ----------------------------------------------------------------------------

async def _q_out(db: AsyncSession, user: User, rows: list[Question]) -> list[QuestionOut]:
    subjects = dict((await db.execute(select(Subject.id, Subject.name).where(Subject.school_id == user.school_id))).all())
    used: dict[uuid.UUID, int] = {}
    for qids in (await db.scalars(select(OnlineTest.question_ids).where(OnlineTest.school_id == user.school_id))).all():
        for q in qids or []:
            used[q] = used.get(q, 0) + 1
    scope = await _scope(db, user)
    return [QuestionOut(id=q.id, class_id=q.class_id, subject_id=q.subject_id, subject_name=subjects.get(q.subject_id, ""), kind=q.kind,
                        text=q.text, options=q.options or [], answer=q.answer or [], marks=q.marks, explanation=q.explanation, topic=q.topic,
                        difficulty=q.difficulty, used_in=used.get(q.id, 0),
                        can_edit=scope is None or q.created_by == user.id) for q in rows]


async def list_questions(db: AsyncSession, user: User, class_id: uuid.UUID, subject_id: uuid.UUID | None, search: str | None) -> list[QuestionOut]:
    scope = await _scope(db, user)
    q = select(Question).where(Question.school_id == user.school_id, Question.class_id == class_id)
    if subject_id:
        q = q.where(Question.subject_id == subject_id)
    if search:
        q = q.where(Question.text.ilike(f"%{search.strip()}%") | Question.topic.ilike(f"%{search.strip()}%"))
    rows = [r for r in (await db.scalars(q.order_by(Question.created_at.desc()).limit(500))).all()
            if await _may_teach(db, user, scope, r.class_id, r.subject_id)]
    return await _q_out(db, user, rows)


async def _check_q(db: AsyncSession, user: User, data: QuestionIn) -> None:
    await get_class(db, user.school_id, data.class_id)
    await _subject(db, user.school_id, data.subject_id)
    if not await _may_teach(db, user, await _scope(db, user), data.class_id, data.subject_id):
        raise Forbidden("You can only add questions for subjects you teach in this class", code="NOT_YOUR_CLASS")


async def create_question(db: AsyncSession, user: User, data: QuestionIn) -> QuestionOut:
    await _check_q(db, user, data)
    q = Question(school_id=user.school_id, created_by=user.id, **{**data.model_dump(), "options": [o.model_dump() for o in data.options]})
    db.add(q)
    await db.flush()
    await db.refresh(q)
    return (await _q_out(db, user, [q]))[0]


async def _question(db: AsyncSession, user: User, question_id: uuid.UUID) -> Question:
    q = await db.scalar(select(Question).where(Question.id == question_id, Question.school_id == user.school_id))
    if not q:
        raise NotFound("Question not found")
    if await _scope(db, user) is not None and q.created_by != user.id:
        raise Forbidden("You can only change questions you wrote", code="NOT_YOUR_QUESTION")
    return q


async def update_question(db: AsyncSession, user: User, question_id: uuid.UUID, data: QuestionIn) -> QuestionOut:
    q = await _question(db, user, question_id)
    await _check_q(db, user, data)
    if await db.scalar(select(TestAttempt.id).join(OnlineTest, OnlineTest.id == TestAttempt.test_id)
                       .where(OnlineTest.question_ids.any(q.id)).limit(1)):
        raise AppError("Students have already answered this question in a test. Copy it to make changes.", code="QUESTION_USED", status_code=409)
    for k, v in data.model_dump().items():
        setattr(q, k, [o.model_dump() for o in data.options] if k == "options" else v)
    await db.flush()
    return (await _q_out(db, user, [q]))[0]


async def delete_question(db: AsyncSession, user: User, question_id: uuid.UUID) -> None:
    q = await _question(db, user, question_id)
    if await db.scalar(select(OnlineTest.id).where(OnlineTest.question_ids.any(q.id)).limit(1)):
        raise AppError("This question is in a test. Remove it from the test first.", code="QUESTION_USED", status_code=409)
    await db.delete(q)


# ---- tests ------------------------------------------------------------------------------------

def _status(t: OnlineTest, now: datetime) -> str:
    if not t.published:
        return "draft"
    return "upcoming" if now < t.opens_at else "open" if now <= t.closes_at else "closed"


async def _max_marks(db: AsyncSession, ids: list[uuid.UUID]) -> Decimal:
    return await db.scalar(select(func.coalesce(func.sum(Question.marks), 0)).where(Question.id.in_(ids))) or Decimal(0)


async def _test_out(db: AsyncSession, user: User, t: OnlineTest, with_stats: bool = True) -> TestOut:
    labels = await _labels(db, user.school_id)
    subject = await db.get(Subject, t.subject_id)
    stats = (await db.execute(select(func.count(), func.count(TestAttempt.submitted_at), func.avg(TestAttempt.score))
                              .where(TestAttempt.test_id == t.id))).first() if with_stats else (0, 0, None)
    max_marks = await _max_marks(db, t.question_ids)
    scope = await _scope(db, user)
    avg = float(stats[2]) * 100 / float(max_marks) if stats[2] is not None and max_marks else None
    return TestOut(id=t.id, title=t.title, instructions=t.instructions, class_id=t.class_id, subject_id=t.subject_id,
                   subject_name=subject.name if subject else "", section_ids=t.section_ids,
                   sections_label=", ".join(labels.get(s, ("", 0))[0] for s in t.section_ids), question_ids=t.question_ids,
                   questions=len(t.question_ids), max_marks=max_marks, opens_at=t.opens_at, closes_at=t.closes_at,
                   duration_minutes=t.duration_minutes, shuffle=t.shuffle, show_results=t.show_results, published=t.published,
                   status=_status(t, _now()), attempts=stats[0], submitted=stats[1], average=round(avg, 1) if avg is not None else None,
                   can_edit=scope is None or t.created_by == user.id)


async def _check_test(db: AsyncSession, user: User, data: TestIn) -> None:
    await get_class(db, user.school_id, data.class_id)
    await _subject(db, user.school_id, data.subject_id)
    scope = await _scope(db, user)
    sections = set(await _class_sections(db, data.class_id))
    for i, sid in enumerate(data.section_ids):
        if sid not in sections:
            raise field_error(f"section_ids.{i}", "Choose sections of this class")
        if not _allowed(scope, sid, data.subject_id):
            raise Forbidden("You can only set tests for sections you teach", code="NOT_YOUR_CLASS")
    found = set((await db.scalars(select(Question.id).where(Question.id.in_(data.question_ids), Question.school_id == user.school_id,
                                                            Question.class_id == data.class_id, Question.subject_id == data.subject_id))).all())
    for i, qid in enumerate(data.question_ids):
        if qid not in found:
            raise field_error(f"question_ids.{i}", "Choose questions from this class and subject's bank")


async def list_tests(db: AsyncSession, user: User) -> list[TestOut]:
    scope = await _scope(db, user)
    q = select(OnlineTest).where(OnlineTest.school_id == user.school_id)
    if scope is not None:
        q = q.where(OnlineTest.created_by == user.id)
    return [await _test_out(db, user, t) for t in (await db.scalars(q.order_by(OnlineTest.opens_at.desc()))).all()]


async def create_test(db: AsyncSession, user: User, data: TestIn) -> TestOut:
    await _check_test(db, user, data)
    t = OnlineTest(school_id=user.school_id, created_by=user.id, **data.model_dump())
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return await _test_out(db, user, t)


async def _test(db: AsyncSession, user: User, test_id: uuid.UUID, edit: bool = False) -> OnlineTest:
    t = await db.scalar(select(OnlineTest).where(OnlineTest.id == test_id, OnlineTest.school_id == user.school_id))
    if not t:
        raise NotFound("Test not found")
    if edit and await _scope(db, user) is not None and t.created_by != user.id:
        raise Forbidden("You can only change tests you set", code="NOT_YOUR_TEST")
    return t


async def update_test(db: AsyncSession, user: User, test_id: uuid.UUID, data: TestIn) -> TestOut:
    t = await _test(db, user, test_id, edit=True)
    if await db.scalar(select(TestAttempt.id).where(TestAttempt.test_id == t.id).limit(1)):
        raise AppError("Students have started this test, so it can't be changed", code="TEST_STARTED", status_code=409)
    await _check_test(db, user, data)
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    await db.flush()
    return await _test_out(db, user, t)


async def publish(db: AsyncSession, user: User, test_id: uuid.UUID, on: bool) -> TestOut:
    t = await _test(db, user, test_id, edit=True)
    if not on and await db.scalar(select(TestAttempt.id).where(TestAttempt.test_id == t.id).limit(1)):
        raise AppError("Students have started this test, so it can't be withdrawn", code="TEST_STARTED", status_code=409)
    if on and t.closes_at <= _now():
        raise field_error("closes_at", "The closing time has passed; move it later first")
    was = t.published
    t.published = on
    await db.flush()
    if on and not was:
        subject = await db.get(Subject, t.subject_id)
        await notification_service.notify(
            db, await notification_service.family_of_sections(db, t.section_ids), school_id=user.school_id, kind="online_test",
            title=f"Online test: {t.title}", body=f"{subject.name if subject else ''} · opens {t.opens_at:%d %b %H:%M} UTC · {t.duration_minutes} min",
            link="/my-tests", data={"test_id": t.id})
        await audit_service.record(db, "online_test.publish", school_id=user.school_id, user_id=user.id, entity_type="online_test",
                                   entity_id=t.id, meta={"title": t.title})
    return await _test_out(db, user, t)


async def delete_test(db: AsyncSession, user: User, test_id: uuid.UUID) -> None:
    t = await _test(db, user, test_id, edit=True)
    if await db.scalar(select(TestAttempt.id).where(TestAttempt.test_id == t.id).limit(1)):
        raise AppError("Students have taken this test; it can't be deleted", code="TEST_STARTED", status_code=409)
    await db.delete(t)


# ---- marking ----------------------------------------------------------------------------------

def _auto_mark(q: Question, answer) -> Decimal | None:
    """Marks for a choice question; None for short answers (a teacher marks them) unless an accepted answer matches."""
    if q.kind == "short":
        if isinstance(answer, str) and answer.strip() and q.answer:
            norm = " ".join(answer.lower().split())
            if norm in {" ".join(a.lower().split()) for a in q.answer}:
                return q.marks
        return None if (isinstance(answer, str) and answer.strip()) else Decimal(0)
    chosen = set(answer if isinstance(answer, list) else [])
    return q.marks if chosen and chosen == set(q.answer or []) else Decimal(0)


async def _finalise(db: AsyncSession, a: TestAttempt, questions: dict[uuid.UUID, Question]) -> None:
    marks: dict[str, float] = dict(a.marks or {})
    pending = False
    for qid in a.order:
        q = questions.get(qid)
        if not q:
            continue
        key = str(qid)
        if key in marks and q.kind == "short":
            continue  # already marked by the teacher
        m = _auto_mark(q, (a.answers or {}).get(key))
        if m is None:
            pending = True
            marks.pop(key, None)
        else:
            marks[key] = float(m)
    a.marks = marks
    a.needs_marking = pending
    a.score = Decimal(str(sum(marks.values())))


async def _questions(db: AsyncSession, ids) -> dict[uuid.UUID, Question]:
    return {q.id: q for q in (await db.scalars(select(Question).where(Question.id.in_(list(ids))))).all()}


async def _close_overdue(db: AsyncSession, attempts: list[TestAttempt]) -> None:
    """Attempts whose time ran out are submitted with what was saved."""
    now = _now()
    late = [a for a in attempts if not a.submitted_at and now > a.deadline + GRACE]
    if not late:
        return
    qs = await _questions(db, {q for a in late for q in a.order})
    for a in late:
        a.submitted_at = a.deadline
        await _finalise(db, a, qs)
    await db.flush()


# ---- students ---------------------------------------------------------------------------------

def _released(t: OnlineTest, a: TestAttempt | None, now: datetime) -> bool:
    if t.show_results == "never" or not a or not a.submitted_at:
        return False
    return t.show_results == "after_submit" or now > t.closes_at


async def my_tests(db: AsyncSession, user: User) -> list[MyTest]:
    kids = await own_students(db, user)
    if not kids:
        return []
    now = _now()
    tests = (await db.scalars(select(OnlineTest).where(OnlineTest.school_id == user.school_id, OnlineTest.published.is_(True),
                                                       OnlineTest.section_ids.overlap([k.section_id for k in kids]))
                              .order_by(OnlineTest.opens_at.desc()))).all()
    attempts = list((await db.scalars(select(TestAttempt).where(TestAttempt.student_id.in_([k.id for k in kids]),
                                                               TestAttempt.test_id.in_([t.id for t in tests])))).all())
    await _close_overdue(db, attempts)
    by = {(a.test_id, a.student_id): a for a in attempts}
    subjects = dict((await db.execute(select(Subject.id, Subject.name).where(Subject.school_id == user.school_id))).all())
    out = []
    for t in tests:
        mx = await _max_marks(db, t.question_ids)
        for k in kids:
            if k.section_id not in t.section_ids:
                continue
            a = by.get((t.id, k.id))
            if a and a.submitted_at:
                state = "submitted"
            elif a:
                state = "in_progress"
            else:
                state = "upcoming" if now < t.opens_at else "open" if now <= t.closes_at else "missed"
            rel = _released(t, a, now)
            out.append(MyTest(test_id=t.id, title=t.title, subject_name=subjects.get(t.subject_id, ""), student_id=k.id,
                              student_name=f"{k.first_name} {k.last_name}", opens_at=t.opens_at, closes_at=t.closes_at,
                              duration_minutes=t.duration_minutes, questions=len(t.question_ids), max_marks=mx, state=state,
                              score=a.score if rel else None, percent=round(float(a.score) * 100 / float(mx), 1) if rel and a.score is not None and mx else None,
                              released=rel))
    return out


async def _student_for(db: AsyncSession, user: User) -> Student:
    """Only students take tests (parents watch)."""
    if user.role != "student":
        raise Forbidden("Only the student can take the test", code="STUDENTS_ONLY")
    s = await db.scalar(select(Student).where(Student.user_id == user.id, Student.status == "active"))
    if not s:
        raise NotFound("Student not found")
    return s


def _paper(q: Question) -> PaperQuestion:
    return PaperQuestion(id=q.id, kind=q.kind, text=q.text, options=q.options or [], marks=q.marks)


async def _view(db: AsyncSession, t: OnlineTest, a: TestAttempt) -> AttemptView:
    qs = await _questions(db, a.order)
    subject = await db.get(Subject, t.subject_id)
    return AttemptView(test_id=t.id, title=t.title, instructions=t.instructions, subject_name=subject.name if subject else "", deadline=a.deadline,
                       submitted=a.submitted_at is not None, questions=[_paper(qs[q]) for q in a.order if q in qs], answers=a.answers or {})


async def start(db: AsyncSession, user: User, test_id: uuid.UUID) -> AttemptView:
    s = await _student_for(db, user)
    t = await _test(db, user, test_id)
    if not t.published or s.section_id not in t.section_ids:
        raise NotFound("Test not found")
    a = await db.scalar(select(TestAttempt).where(TestAttempt.test_id == t.id, TestAttempt.student_id == s.id))
    now = _now()
    if a is None:
        if now < t.opens_at:
            raise AppError(f"The test opens at {t.opens_at:%d %b %H:%M} UTC", code="TEST_NOT_OPEN", status_code=409)
        if now > t.closes_at:
            raise AppError("The test has closed", code="TEST_CLOSED", status_code=409)
        order = list(t.question_ids)
        if t.shuffle:
            random.Random(f"{t.id}{s.id}").shuffle(order)
        a = TestAttempt(school_id=t.school_id, test_id=t.id, student_id=s.id, order=order, answers={}, marks={}, started_at=now,
                        deadline=min(now + timedelta(minutes=t.duration_minutes), t.closes_at))
        db.add(a)
        await db.flush()
    else:
        await _close_overdue(db, [a])
    return await _view(db, t, a)


async def _open_attempt(db: AsyncSession, user: User, test_id: uuid.UUID) -> tuple[OnlineTest, TestAttempt]:
    s = await _student_for(db, user)
    t = await _test(db, user, test_id)
    a = await db.scalar(select(TestAttempt).where(TestAttempt.test_id == t.id, TestAttempt.student_id == s.id))
    if not a:
        raise NotFound("Start the test first")
    await _close_overdue(db, [a])
    if a.submitted_at:
        raise AppError("This test has been submitted", code="TEST_SUBMITTED", status_code=409)
    return t, a


async def save_answers(db: AsyncSession, user: User, test_id: uuid.UUID, answers: dict) -> dict:
    t, a = await _open_attempt(db, user, test_id)
    allowed = {str(q) for q in a.order}
    a.answers = {**(a.answers or {}), **{k: v for k, v in answers.items() if k in allowed}}
    await db.flush()
    return {"saved": len(a.answers), "deadline": a.deadline.isoformat()}


async def submit(db: AsyncSession, user: User, test_id: uuid.UUID, answers: dict | None) -> AttemptResult:
    t, a = await _open_attempt(db, user, test_id)
    if answers:
        allowed = {str(q) for q in a.order}
        a.answers = {**(a.answers or {}), **{k: v for k, v in answers.items() if k in allowed}}
    a.submitted_at = min(_now(), a.deadline)
    await _finalise(db, a, await _questions(db, a.order))
    await db.flush()
    return await result(db, user, test_id, a.student_id)


async def result(db: AsyncSession, user: User, test_id: uuid.UUID, student_id: uuid.UUID) -> AttemptResult:
    t = await _test(db, user, test_id)
    s = await db.scalar(select(Student).where(Student.id == student_id, Student.school_id == user.school_id))
    staff = await _may_teach(db, user, await _scope(db, user), t.class_id, t.subject_id) if user.role not in ("parent", "student") else False
    if not s or (not staff and s.id not in {k.id for k in await own_students(db, user)}):
        raise NotFound("Result not found")
    a = await db.scalar(select(TestAttempt).where(TestAttempt.test_id == t.id, TestAttempt.student_id == s.id))
    if a:
        await _close_overdue(db, [a])
    mx = await _max_marks(db, t.question_ids)
    rel = staff or _released(t, a, _now())
    out = AttemptResult(test_id=t.id, title=t.title, student_id=s.id, student_name=f"{s.first_name} {s.last_name}",
                        submitted_at=a.submitted_at if a else None, score=a.score if a and rel else None, max_marks=mx,
                        percent=round(float(a.score) * 100 / float(mx), 1) if a and rel and a.score is not None and mx else None,
                        needs_marking=bool(a and a.needs_marking), released=rel)
    if a and rel and a.submitted_at:
        qs = await _questions(db, a.order)
        out.questions = [ResultQuestion(id=q.id, kind=q.kind, text=q.text, options=q.options or [], marks=q.marks,
                                        your_answer=(a.answers or {}).get(str(q.id)), correct=q.answer or [],
                                        awarded=Decimal(str((a.marks or {})[str(q.id)])) if str(q.id) in (a.marks or {}) else None,
                                        explanation=q.explanation) for q in (qs[x] for x in a.order if x in qs)]
    return out


# ---- teachers: results ------------------------------------------------------------------------

async def results(db: AsyncSession, user: User, test_id: uuid.UUID) -> TestResults:
    t = await _test(db, user, test_id)
    if not await _may_teach(db, user, await _scope(db, user), t.class_id, t.subject_id):
        raise NotFound("Test not found")
    students = (await db.scalars(select(Student).where(Student.section_id.in_(t.section_ids), Student.status == "active")
                                 .order_by(Student.section_id, Student.roll_no.nulls_last(), Student.first_name))).all()
    attempts = list((await db.scalars(select(TestAttempt).where(TestAttempt.test_id == t.id))).all())
    await _close_overdue(db, attempts)
    by = {a.student_id: a for a in attempts}
    mx = await _max_marks(db, t.question_ids)
    labels = await _labels(db, user.school_id)
    rows = []
    for s in students:
        a = by.get(s.id)
        rows.append(AttemptRow(attempt_id=a.id if a else None, student_id=s.id, name=f"{s.first_name} {s.last_name}", roll_no=s.roll_no,
                               section_label=labels.get(s.section_id, ("", 0))[0],
                               state="submitted" if a and a.submitted_at else "in_progress" if a else "not_started",
                               score=a.score if a else None,
                               percent=round(float(a.score) * 100 / float(mx), 1) if a and a.score is not None and mx else None,
                               needs_marking=bool(a and a.needs_marking), submitted_at=a.submitted_at if a else None))
    qs = await _questions(db, t.question_ids)
    stats = []
    done = [a for a in attempts if a.submitted_at]
    for qid in t.question_ids:
        q = qs.get(qid)
        if not q:
            continue
        marked = [a for a in done if str(qid) in (a.marks or {})]
        right = sum(1 for a in marked if Decimal(str(a.marks[str(qid)])) >= q.marks)
        answered = sum(1 for a in done if (a.answers or {}).get(str(qid)) not in (None, "", []))
        stats.append(QuestionStat(question_id=qid, text=q.text[:200], kind=q.kind,
                                  correct_percent=round(right * 100 / len(marked), 1) if marked else None, answered=answered))
    return TestResults(test=await _test_out(db, user, t), rows=rows, questions=stats)


async def mark_short(db: AsyncSession, user: User, test_id: uuid.UUID, student_id: uuid.UUID, marks: dict) -> AttemptResult:
    t = await _test(db, user, test_id)
    if not await _may_teach(db, user, await _scope(db, user), t.class_id, t.subject_id):
        raise NotFound("Test not found")
    a = await db.scalar(select(TestAttempt).where(TestAttempt.test_id == t.id, TestAttempt.student_id == student_id))
    if not a or not a.submitted_at:
        raise NotFound("No submitted answers to mark")
    qs = await _questions(db, a.order)
    new = dict(a.marks or {})
    for qid, m in marks.items():
        q = qs.get(qid)
        if not q or q.kind != "short":
            raise field_error("marks", "Only short-answer questions are marked by hand")
        if m > q.marks:
            raise field_error("marks", f"At most {q.marks} marks for this question")
        new[str(qid)] = float(m)
    a.marks = new
    await _finalise(db, a, qs)
    await db.flush()
    return await result(db, user, test_id, student_id)
