---
name: schoolerp-phase-05-exams
description: >
  Phase 5 of SchoolERP (Python + Flutter) — offline exams (datesheet, mark entry,
  report cards via WeasyPrint), online CBT engine (9 question types, 3 modes,
  autosave, subjective queue, item analysis), and Zoom/Meet live classes.
  Use when building exam management, CBT, question banks, or live classes.
---
# Phase 5 — Examinations & Live Classes
## Python FastAPI · Flutter

## Key SQLAlchemy Models

```python
# api/app/models/exams.py
class Question(Base):
    __tablename__ = "questions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    type: Mapped[str] = mapped_column(String(20))  # mcq|true_false|short|long|fill|match|audio|video|equation
    difficulty: Mapped[str] = mapped_column(String(10), default="medium")
    topic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content: Mapped[dict] = mapped_column(JSONB)  # question body + options + correct answers
    marks: Mapped[int] = mapped_column(default=1)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

class OnlineExam(Base):
    __tablename__ = "online_exams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    title: Mapped[str] = mapped_column(String(200))
    mode: Mapped[str] = mapped_column(String(20))  # exam|quiz|practice
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    question_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)))
    duration_minutes: Mapped[int] = mapped_column()
    shuffle_questions: Mapped[bool] = mapped_column(default=False)
    shuffle_options: Mapped[bool] = mapped_column(default=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    online_exam_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_exams.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    autosave_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {question_id: answer}
    score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    __table_args__ = (UniqueConstraint("online_exam_id", "student_id"),)
```

## CBT Service (Python)

```python
# api/app/services/exam_service.py

async def autosave_attempt(db: AsyncSession, attempt_id: uuid.UUID, answers: dict):
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt or attempt.status != "in_progress":
        raise BadRequestException("Attempt not active")
    # Merge (don't overwrite — student may have answered other questions)
    current = attempt.autosave_data or {}
    current.update(answers)
    attempt.autosave_data = current
    await db.commit()

async def submit_attempt(db: AsyncSession, attempt_id: uuid.UUID, final_answers: dict) -> dict:
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt or attempt.status != "in_progress":
        raise BadRequestException("Attempt cannot be submitted")

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
```

## Flutter — CBT Exam Interface

```dart
// lib/features/exams/screens/exam_attempt_screen.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/exam_attempt_provider.dart';

class ExamAttemptScreen extends ConsumerStatefulWidget {
  final String examId;
  const ExamAttemptScreen({super.key, required this.examId});
  @override
  ConsumerState<ExamAttemptScreen> createState() => _ExamAttemptScreenState();
}

class _ExamAttemptScreenState extends ConsumerState<ExamAttemptScreen> {
  int _currentIndex = 0;
  late Timer _autosaveTimer;
  late Timer _countdownTimer;
  int _secondsLeft = 0;

  @override
  void initState() {
    super.initState();
    // Autosave every 30 seconds
    _autosaveTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      ref.read(examAttemptProvider(widget.examId).notifier).autosave();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(examAttemptProvider(widget.examId));

    return state.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('Error: $e'))),
      data: (attempt) => Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Text(attempt.exam.title),
          actions: [
            // Countdown timer
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: _secondsLeft < 300 ? Colors.red : Colors.green,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(_formatTime(_secondsLeft),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        body: Column(children: [
          // Question navigator chips
          SizedBox(
            height: 48,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              itemCount: attempt.questions.length,
              itemBuilder: (ctx, i) => GestureDetector(
                onTap: () => setState(() => _currentIndex = i),
                child: Container(
                  margin: const EdgeInsets.all(4),
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: attempt.answers.containsKey(attempt.questions[i].id)
                        ? Colors.green
                        : (i == _currentIndex ? const Color(0xFF1A3C5E) : Colors.grey.shade200),
                    shape: BoxShape.circle,
                  ),
                  child: Center(child: Text('${i + 1}',
                    style: TextStyle(
                      color: attempt.answers.containsKey(attempt.questions[i].id) || i == _currentIndex
                          ? Colors.white : Colors.black,
                      fontSize: 12,
                    ))),
                ),
              ),
            ),
          ),
          // Current question
          Expanded(child: QuestionWidget(
            question: attempt.questions[_currentIndex],
            answer: attempt.answers[attempt.questions[_currentIndex].id],
            onAnswer: (ans) => ref.read(examAttemptProvider(widget.examId).notifier)
                .setAnswer(attempt.questions[_currentIndex].id, ans),
          )),
          // Navigation
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              if (_currentIndex > 0)
                OutlinedButton(onPressed: () => setState(() => _currentIndex--), child: const Text('Previous')),
              const Spacer(),
              if (_currentIndex < attempt.questions.length - 1)
                ElevatedButton(onPressed: () => setState(() => _currentIndex++), child: const Text('Next'))
              else
                ElevatedButton(
                  onPressed: () => _confirmSubmit(context, attempt),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                  child: const Text('Submit'),
                ),
            ]),
          ),
        ]),
      ),
    );
  }

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _confirmSubmit(BuildContext context, ExamAttemptState attempt) async {
    final unanswered = attempt.questions.length - attempt.answers.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Submit Exam?'),
        content: unanswered > 0
            ? Text('$unanswered question(s) unanswered. Are you sure?')
            : const Text('Submit your exam now?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit')),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await ref.read(examAttemptProvider(widget.examId).notifier).submit();
      context.go('/exams/result/${widget.examId}');
    }
  }

  @override
  void dispose() { _autosaveTimer.cancel(); _countdownTimer.cancel(); super.dispose(); }
}
```

## Testing — Phase 5

```python
@pytest.mark.asyncio
async def test_autosave_merges_answers(db):
    attempt = await create_test_attempt(db)
    await exam_service.autosave_attempt(db, attempt.id, {"q1": "A"})
    await exam_service.autosave_attempt(db, attempt.id, {"q2": "B"})
    updated = await db.get(ExamAttempt, attempt.id)
    assert updated.autosave_data == {"q1": "A", "q2": "B"}

@pytest.mark.asyncio
async def test_submit_auto_grades_mcq(db):
    # q1: MCQ correct answer = "A", q2: MCQ correct = "B"
    result = await exam_service.submit_attempt(db, attempt.id, {"q1_id": "A", "q2_id": "C"})
    assert result["auto_score"] == 1  # only q1 correct
    assert result["pending_subjective"] == 0

@pytest.mark.asyncio
async def test_item_analysis_correct_percentages(db):
    # 3 attempts: 2 correct, 1 wrong on q1
    analysis = await exam_service.get_item_analysis(db, exam.id)
    q1_stats = next(a for a in analysis if a["question_id"] == str(Q1_ID))
    assert q1_stats["correct_pct"] == pytest.approx(66.7, rel=0.1)
```

## Antigravity Prompt for Phase 5

```
@file skills/master-plan/SKILL.md
@file skills/phase-05-exams/SKILL.md

Build Phase 5 — Exams:
1. SQLAlchemy models + Alembic migration
2. Offline exam module: datesheet, admit card PDF (WeasyPrint), mark entry API,
   grade calculator, report card PDF template
3. Question bank: CRUD with 9 types stored as JSONB content field
4. Online CBT: autosave (merge-not-overwrite), submit with auto-grading for MCQ/T-F/fill,
   subjective review queue API, re-grade endpoint
5. Item analysis endpoint: correct/wrong/skip % per question
6. Flutter CBT exam screen: countdown timer, question navigator chips,
   QuestionWidget (renders all 9 types), autosave timer, confirm-submit dialog
7. Flutter exam result screen: score display, per-question review, item analysis chart
8. Zoom/Meet live class scheduling: store meeting_url + join_link per session
9. All tests: pytest for CBT engine + autosave merge + item analysis; flutter_test for timer
```
