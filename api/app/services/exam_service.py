import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.exams import ExamAttempt, OnlineExam, Question

async def autosave_attempt(db: AsyncSession, attempt_id: uuid.UUID, answers: dict):
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt or attempt.status != "in_progress":
        raise ValueError("Attempt not active")
    # Merge (don't overwrite — student may have answered other questions)
    current = attempt.autosave_data or {}
    current.update(answers)
    attempt.autosave_data = current
    await db.commit()

def _check_auto_answer(question: Question, answer) -> bool:
    content = question.content
    if question.type == "mcq":
        return answer == content.get("correct_option_id")
    if question.type == "true_false":
        return str(answer).lower() == str(content.get("correct")).lower()
    if question.type == "fill":
        blanks = {b["id"]: b["answer"].lower() for b in content.get("blanks", [])}
        if isinstance(answer, dict):
            return all(answer.get(k, "").lower() == v for k, v in blanks.items())
    return False

async def submit_attempt(db: AsyncSession, attempt_id: uuid.UUID, final_answers: dict) -> dict:
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt or attempt.status != "in_progress":
        raise ValueError("Attempt cannot be submitted")

    # Merge final answers
    all_answers = {**(attempt.autosave_data or {}), **final_answers}

    # Load exam + questions
    exam = await db.get(OnlineExam, attempt.online_exam_id)
    questions = await db.scalars(select(Question).where(Question.id.in_(exam.question_ids)))
    questions = {str(q.id): q for q in questions.all()}

    auto_score = Decimal("0")
    pending_subjective = []

    for q_id, q in questions.items():
        answer = all_answers.get(q_id)
        if q.type in ("mcq", "true_false", "fill"):
            if _check_auto_answer(q, answer):
                auto_score += q.marks
        elif q.type in ("short", "long"):
            pending_subjective.append(q_id)

    attempt.submitted_at = datetime.utcnow()
    attempt.autosave_data = all_answers
    attempt.status = "submitted" if pending_subjective else "graded"
    if not pending_subjective:
        attempt.score = auto_score
    await db.commit()

    return {"auto_score": float(auto_score), "pending_subjective": len(pending_subjective)}

async def get_item_analysis(db: AsyncSession, exam_id: uuid.UUID) -> list:
    attempts = await db.scalars(
        select(ExamAttempt).where(ExamAttempt.online_exam_id == exam_id, ExamAttempt.status != "in_progress")
    )
    exam = await db.get(OnlineExam, exam_id)
    questions = await db.scalars(select(Question).where(Question.id.in_(exam.question_ids)))

    analysis = []
    all_attempts = list(attempts.all())
    for q in questions.all():
        q_id = str(q.id)
        correct = wrong = skip = 0
        for attempt in all_attempts:
            answers = attempt.autosave_data or {}
            answer = answers.get(q_id)
            if answer is None:
                skip += 1
            elif _check_auto_answer(q, answer):
                correct += 1
            else:
                wrong += 1
        total = len(all_attempts)
        analysis.append({
            "question_id": q_id,
            "correct_pct": round(correct / total * 100, 1) if total else 0,
            "wrong_pct": round(wrong / total * 100, 1) if total else 0,
            "skip_pct": round(skip / total * 100, 1) if total else 0,
        })
    return analysis
