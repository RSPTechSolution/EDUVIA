---
name: schoolerp-phase-11-ai-analytics
description: >
  Phase 11 of SchoolERP (Python + Flutter) — AI assistant using LangChain
  with safe pre-approved query templates (no raw SQL from model), Google Gemini
  and OpenAI support, role-based privacy filtering, streaming responses,
  analytics dashboard with fl_chart, custom report builder with openpyxl/WeasyPrint.
---
# Phase 11 — AI Assistant & Analytics
## Python FastAPI · LangChain · Flutter

## AI Architecture: Safe Query Templates

```
User natural language → LangChain intent classifier
→ Match to pre-approved query template
→ Execute parameterized SQLAlchemy query (never raw SQL)
→ Feed result back to LLM for natural language summary
→ Stream response to client
```

## LangChain Intent Classifier

```python
# api/app/services/ai/intent_classifier.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel
import json

AVAILABLE_INTENTS = [
    "fee.outstanding", "fee.collected_today", "fee.defaulters",
    "attendance.low", "attendance.today", "attendance.student",
    "student.count", "student.new_admissions",
    "exam.top_performers", "exam.pass_rate",
    "staff.present_today", "staff.on_leave",
    "general.greeting", "general.unknown",
]

class IntentResult(BaseModel):
    intent: str
    params: dict
    confidence: float

CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", f"""You are a school ERP assistant. Classify the user query into one of these intents:
{json.dumps(AVAILABLE_INTENTS, indent=2)}

Return ONLY valid JSON matching this schema:
{{"intent": "<intent_slug>", "params": {{}}, "confidence": 0.0-1.0}}

Examples:
- "Which students have fees above 5000?" → {{"intent": "fee.outstanding", "params": {{"min_amount": 5000}}, "confidence": 0.95}}
- "Today's attendance?" → {{"intent": "attendance.today", "params": {{}}, "confidence": 0.99}}
- "Hello" → {{"intent": "general.greeting", "params": {{}}, "confidence": 1.0}}
"""),
    ("human", "{query}"),
])

def get_llm(provider: str, model_name: str = None):
    if provider == "openai":
        return ChatOpenAI(model=model_name or "gpt-4o-mini", temperature=0)
    elif provider == "gemini":
        return ChatGoogleGenerativeAI(model=model_name or "gemini-1.5-flash", temperature=0)
    raise ValueError(f"Unknown provider: {provider}")

async def classify_intent(query: str, provider: str = "openai") -> IntentResult:
    llm = get_llm(provider)
    chain = CLASSIFY_PROMPT | llm | JsonOutputParser()
    result = await chain.ainvoke({"query": query})
    return IntentResult(**result)
```

## Pre-Approved Query Templates (Safe — No Raw SQL)

```python
# api/app/services/ai/query_templates.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

# Role-based access per intent
INTENT_ROLES = {
    "fee.outstanding":      ["school_admin", "accountant", "principal"],
    "fee.collected_today":  ["school_admin", "accountant", "principal"],
    "fee.defaulters":       ["school_admin", "accountant"],
    "attendance.low":       ["school_admin", "principal", "teacher"],
    "attendance.today":     ["school_admin", "principal", "teacher"],
    "student.count":        ["school_admin", "principal", "teacher", "accountant"],
    "exam.top_performers":  ["school_admin", "principal", "teacher"],
    "staff.present_today":  ["school_admin", "principal"],
    "general.greeting":     ["*"],   # all roles
    "general.unknown":      ["*"],
}

async def execute_intent(
    db: AsyncSession, intent: str, params: dict,
    school_id: uuid.UUID, user_role: str,
) -> dict:
    """Execute a pre-approved query. NEVER executes raw SQL from LLM output."""

    allowed_roles = INTENT_ROLES.get(intent, [])
    if "*" not in allowed_roles and user_role not in allowed_roles:
        return {"error": f"You don't have permission to query: {intent}"}

    if intent == "fee.outstanding":
        min_amount = Decimal(str(params.get("min_amount", 0)))
        rows = await db.scalars(
            select(FeeInvoice).where(
                FeeInvoice.school_id == school_id,
                FeeInvoice.status.in_(["unpaid", "partial"]),
                (FeeInvoice.total_amount - FeeInvoice.paid_amount) >= min_amount,
            ).limit(20)
        )
        return {"items": [r.__dict__ for r in rows.all()], "type": "fee_list"}

    elif intent == "attendance.today":
        today = date.today()
        total = await db.scalar(select(func.count(Student.id)).where(Student.school_id == school_id))
        present = await db.scalar(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.date == today,
                AttendanceRecord.status == "present",
            )
        )
        return {"type": "attendance_summary", "date": str(today), "total": total, "present": present,
                "absent": total - present, "rate": round(present / total * 100, 1) if total else 0}

    elif intent == "general.greeting":
        return {"type": "greeting"}

    elif intent == "general.unknown":
        return {"type": "unknown"}

    # Add all other intents...
    return {"type": "empty", "message": "No data found"}
```

## Streaming AI Response Endpoint

```python
# api/app/routers/ai_analytics.py
from fastapi.responses import StreamingResponse
from langchain_core.prompts import ChatPromptTemplate

SUMMARIZE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful school ERP assistant. Summarize the following school data "
               "in 2-3 clear sentences. Be specific with numbers. Do not hallucinate — "
               "only use the data provided."),
    ("human", "User asked: {query}\n\nData: {data}"),
])

@router.post("/ai/chat")
async def ai_chat(
    body: AiChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    school = await db.get(School, current_user.school_id)
    provider = school.settings.get("ai_provider", "openai")

    # Step 1: Classify intent
    intent_result = await classify_intent(body.message, provider)

    # Step 2: Execute safe query
    data = await execute_intent(db, intent_result.intent, intent_result.params,
                                 current_user.school_id, current_user.role)

    if "error" in data:
        return ApiResponse(data={"response": data["error"]})

    # Step 3: Stream natural language summary
    llm = get_llm(provider)
    chain = SUMMARIZE_PROMPT | llm

    async def stream_response():
        import json as json_lib
        async for chunk in chain.astream({"query": body.message, "data": json_lib.dumps(data, default=str)[:3000]}):
            yield f"data: {chunk.content}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")
```

## Analytics Dashboard Endpoints

```python
# api/app/routers/ai_analytics.py

@router.get("/analytics/dashboard")
async def dashboard_analytics(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    school_id = current_user.school_id
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    # Attendance trend (last 30 days)
    att_trend = await db.execute(
        select(
            AttendanceRecord.date,
            func.count(func.distinct(AttendanceRecord.student_id)).filter(AttendanceRecord.status == "present").label("present"),
            func.count(func.distinct(AttendanceRecord.student_id)).label("total"),
        ).where(AttendanceRecord.school_id == school_id, AttendanceRecord.date >= thirty_days_ago)
         .group_by(AttendanceRecord.date).order_by(AttendanceRecord.date)
    )

    # Fee collection trend (last 30 days)
    fee_trend = await db.execute(
        select(
            func.date_trunc("day", FeePayment.paid_at).label("day"),
            func.sum(FeePayment.amount).label("collected"),
        ).where(FeePayment.school_id == school_id, FeePayment.paid_at >= thirty_days_ago)
         .group_by(func.date_trunc("day", FeePayment.paid_at)).order_by("day")
    )

    return ApiResponse(data={
        "attendance_trend": [{"date": str(r.date), "rate": round(r.present/r.total*100,1) if r.total else 0}
                              for r in att_trend],
        "fee_trend": [{"date": str(r.day.date()), "collected": float(r.collected)} for r in fee_trend],
    })
```

## Flutter — AI Chat Screen

```dart
// lib/features/ai/screens/ai_chat_screen.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key});
  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _messages = <ChatMessage>[];
  final _inputCtrl = TextEditingController();
  bool _isStreaming = false;

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    setState(() {
      _messages.add(ChatMessage(role: 'user', content: text));
      _messages.add(ChatMessage(role: 'assistant', content: ''));
      _isStreaming = true;
    });
    _inputCtrl.clear();

    final dio = ref.read(dioProvider);
    final token = await ref.read(authTokenProvider.future);
    final buffer = StringBuffer();

    try {
      final response = await dio.post(
        '/api/v1/ai/chat',
        data: {'message': text},
        options: Options(
          headers: {'Authorization': 'Bearer $token', 'Accept': 'text/event-stream'},
          responseType: ResponseType.stream,
        ),
      );

      await for (final chunk in (response.data as ResponseBody).stream) {
        final lines = String.fromCharCodes(chunk).split('\n');
        for (final line in lines) {
          if (line.startsWith('data: ') && !line.contains('[DONE]')) {
            buffer.write(line.substring(6));
            setState(() => _messages.last = ChatMessage(role: 'assistant', content: buffer.toString()));
          }
        }
      }
    } catch (e) {
      setState(() => _messages.last = ChatMessage(role: 'assistant', content: 'Error: ${e.toString()}'));
    } finally {
      setState(() => _isStreaming = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('AI Assistant'), actions: [
      const Icon(Icons.auto_awesome, color: Color(0xFF2E7D9E)),
      const SizedBox(width: 16),
    ]),
    body: Column(children: [
      // Suggestion chips
      if (_messages.isEmpty) Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(spacing: 8, children: [
          "What's today's attendance?",
          "Students with fee outstanding > ₹5000",
          "Top performers in last exam",
          "Staff on leave today",
        ].map((q) => ActionChip(
          label: Text(q, style: const TextStyle(fontSize: 12)),
          onPressed: () => _sendMessage(q),
        )).toList()),
      ),
      Expanded(child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _messages.length,
        itemBuilder: (_, i) {
          final msg = _messages[i];
          final isUser = msg.role == 'user';
          return Align(
            alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
              decoration: BoxDecoration(
                color: isUser ? const Color(0xFF1A3C5E) : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: msg.content.isEmpty && !isUser
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(msg.content, style: TextStyle(color: isUser ? Colors.white : Colors.black87)),
            ),
          );
        },
      )),
      Padding(
        padding: EdgeInsets.only(left: 16, right: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16, top: 8),
        child: Row(children: [
          Expanded(child: TextField(
            controller: _inputCtrl,
            decoration: InputDecoration(
              hintText: 'Ask anything about your school...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onSubmitted: _isStreaming ? null : _sendMessage,
          )),
          const SizedBox(width: 8),
          FloatingActionButton(
            mini: true,
            onPressed: _isStreaming ? null : () => _sendMessage(_inputCtrl.text),
            child: const Icon(Icons.send),
          ),
        ]),
      ),
    ]),
  );
}
```

## Flutter — Analytics Dashboard Screen

```dart
// lib/features/analytics/screens/analytics_screen.dart
import 'package:fl_chart/fl_chart.dart';

// Shows:
// - Attendance trend: fl_chart LineChart (30 days)
// - Fee collection: fl_chart BarChart (30 days)
// - Student gender donut: fl_chart PieChart
// - Quick stats row: total students, staff, today attendance %, fee outstanding
```

## Testing — Phase 11

```python
@pytest.mark.asyncio
async def test_intent_classifier_fee_outstanding():
    result = await classify_intent("Which students have pending fees above 3000?", provider="openai")
    assert result.intent == "fee.outstanding"
    assert result.params.get("min_amount") == 3000

@pytest.mark.asyncio
async def test_execute_intent_respects_role_permissions(db):
    # Teacher should not access fee.defaulters
    result = await execute_intent(db, "fee.defaulters", {}, SCHOOL_ID, user_role="teacher")
    assert "error" in result
    assert "permission" in result["error"].lower()

@pytest.mark.asyncio
async def test_execute_intent_never_uses_raw_sql(db, monkeypatch):
    """Ensure raw SQL is never executed regardless of LLM output"""
    raw_calls = []
    original = db.execute
    async def patched(stmt, *args, **kwargs):
        if isinstance(stmt, str):
            raw_calls.append(stmt)
        return await original(stmt, *args, **kwargs)
    monkeypatch.setattr(db, "execute", patched)

    await execute_intent(db, "fee.outstanding", {}, SCHOOL_ID, "accountant")
    assert len(raw_calls) == 0, "Raw SQL strings were executed!"

@pytest.mark.asyncio
async def test_dashboard_analytics_returns_30_day_trend(auth_client):
    res = await auth_client.get("/api/v1/analytics/dashboard")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "attendance_trend" in data
    assert "fee_trend" in data
    assert len(data["attendance_trend"]) <= 30
```

## Antigravity Prompt for Phase 11

```
@file skills/master-plan/SKILL.md
@file skills/phase-11-ai-analytics/SKILL.md

Build Phase 11 — AI & Analytics:
1. LangChain intent classifier (OpenAI + Gemini) with JSON output parser
2. 40+ pre-approved query templates as SQLAlchemy queries — ZERO raw SQL from LLM
3. Role-based intent access map (INTENT_ROLES dict)
4. Streaming SSE endpoint using FastAPI StreamingResponse + LangChain astream()
5. Analytics dashboard endpoint: 30-day attendance trend + fee collection trend
6. Custom report builder API: column selector → parameterized query → paginated data
7. openpyxl Excel export + WeasyPrint PDF export for custom reports
8. Flutter AI chat screen: streaming SSE via Dio ResponseType.stream, suggestion chips
9. Flutter analytics screen: fl_chart LineChart (attendance trend), BarChart (fees), PieChart (gender)
10. All tests: pytest (intent classification, role permission, no-raw-SQL guard, 30-day trend) + flutter_test
```
