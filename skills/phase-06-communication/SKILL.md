---
name: schoolerp-phase-06-communication
description: >
  Phase 6 of SchoolERP (Python + Flutter) — SMS (32+ gateways via adapter classes),
  WhatsApp Business API (7 providers), email (FastAPI-Mail), WebSocket-based threaded
  chat (python-socketio), PTM scheduling, surveys with 9 question types and NPS,
  engagement creatives, knowledge base chatbot. Use when building messaging, chat,
  notifications, surveys, or engagement features.
---
# Phase 6 — Communication & Engagement
## Python FastAPI · python-socketio · Celery · Flutter

## SMS/WhatsApp Gateway Adapters (Python ABC)

```python
# api/app/services/gateways/sms_base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class SmsResult:
    gateway_ref: str
    status: str  # sent|failed

class SmsGateway(ABC):
    @abstractmethod
    async def send(self, to: str, body: str) -> SmsResult:
        pass

# api/app/services/gateways/msg91.py
import httpx

class Msg91Gateway(SmsGateway):
    def __init__(self, auth_key: str, template_id: str, sender_id: str):
        self.auth_key = auth_key
        self.template_id = template_id
        self.sender_id = sender_id

    async def send(self, to: str, body: str) -> SmsResult:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.msg91.com/api/v5/flow/",
                json={"template_id": self.template_id,
                      "recipients": [{"mobiles": to, "var": body}]},
                headers={"authkey": self.auth_key, "Content-Type": "application/json"},
            )
            data = res.json()
            return SmsResult(gateway_ref=data.get("request_id", ""), status="sent" if res.is_success else "failed")

class Fast2SmsGateway(SmsGateway):
    async def send(self, to: str, body: str) -> SmsResult: ...

class TwilioGateway(SmsGateway):
    async def send(self, to: str, body: str) -> SmsResult: ...

class TextlocalGateway(SmsGateway):
    async def send(self, to: str, body: str) -> SmsResult: ...

# Factory (school picks gateway in settings)
def get_sms_gateway(school_settings: dict) -> SmsGateway:
    gw = school_settings.get("sms_gateway", "msg91")
    config = school_settings.get("sms_config", {})
    return {
        "msg91": lambda: Msg91Gateway(config["auth_key"], config["template_id"], config["sender_id"]),
        "fast2sms": lambda: Fast2SmsGateway(**config),
        "twilio": lambda: TwilioGateway(**config),
        "textlocal": lambda: TextlocalGateway(**config),
    }[gw]()
```

## WebSocket Chat (python-socketio)

```python
# api/app/core/socket.py
import socketio
from app.core.security import decode_token
from app.services.chat_service import save_message, get_thread_participants

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token") if auth else None
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Unauthorized")
    try:
        user = decode_token(token)
        await sio.save_session(sid, {"user_id": user["sub"], "school_id": user["school_id"]})
    except Exception:
        raise socketio.exceptions.ConnectionRefusedError("Invalid token")

@sio.event
async def join_thread(sid, data):
    thread_id = data.get("thread_id")
    session = await sio.get_session(sid)
    participants = await get_thread_participants(thread_id)
    if session["user_id"] not in participants:
        return {"error": "Not a participant"}
    await sio.enter_room(sid, f"thread_{thread_id}")
    return {"status": "joined"}

@sio.event
async def send_message(sid, data):
    session = await sio.get_session(sid)
    thread_id = data["thread_id"]
    body = data["body"]
    msg = await save_message(thread_id, session["user_id"], body, data.get("attachments", []))
    # Emit to all room participants
    await sio.emit("new_message", msg.dict(), room=f"thread_{thread_id}")
    # Firebase push to offline users
    await send_firebase_push_to_offline(thread_id, session["user_id"], body)

# Mount socket.io as ASGI app alongside FastAPI
# api/app/main.py
from app.core.socket import sio
import socketio
socket_app = socketio.ASGIApp(sio, app)
# In production: uvicorn app.main:socket_app
```

## Survey Engine

```python
# api/app/services/survey_service.py

def calculate_nps(scores: list[int]) -> float:
    """Scores are 0-10. NPS = %Promoters(9-10) - %Detractors(0-6)"""
    if not scores:
        return 0.0
    total = len(scores)
    promoters = sum(1 for s in scores if s >= 9) / total * 100
    detractors = sum(1 for s in scores if s <= 6) / total * 100
    return round(promoters - detractors, 1)

async def get_survey_analytics(db: AsyncSession, survey_id: uuid.UUID) -> dict:
    survey = await db.get(Survey, survey_id)
    responses = await db.scalars(select(SurveyResponse).where(SurveyResponse.survey_id == survey_id))
    responses = list(responses.all())

    analytics = {}
    for question in survey.questions:
        q_id = question["id"]
        q_type = question["type"]
        answers = [r.answers.get(q_id) for r in responses if r.answers.get(q_id) is not None]

        if q_type == "nps":
            analytics[q_id] = {"type": "nps", "score": calculate_nps([int(a) for a in answers]), "count": len(answers)}
        elif q_type in ("mcq", "checkbox"):
            from collections import Counter
            analytics[q_id] = {"type": q_type, "distribution": dict(Counter(str(a) for a in answers))}
        elif q_type == "rating":
            analytics[q_id] = {"type": "rating", "average": sum(int(a) for a in answers) / len(answers) if answers else 0}
        else:
            analytics[q_id] = {"type": q_type, "responses": answers[:50]}  # sample

    return {"total_responses": len(responses), "analytics": analytics}
```

## Celery Task — Engagement Scheduler

```python
# api/app/tasks/engagement_tasks.py
from celery import shared_task
from app.models.engagement import Engagement

@shared_task
def send_birthday_greetings():
    """Runs daily at 8am. Sends greetings to students with today's birthday."""
    import asyncio
    asyncio.run(_send_birthdays())

async def _send_birthdays():
    async with AsyncSessionLocal() as db:
        today = date.today()
        students = await db.scalars(
            select(Student).where(
                func.extract("month", Student.date_of_birth) == today.month,
                func.extract("day", Student.date_of_birth) == today.day,
            )
        )
        for student in students.all():
            # Get parent contact
            parents = student.parents
            for parent in parents:
                message = f"🎉 Wishing {student.first_name} a very Happy Birthday! - {student.school.name}"
                gateway = get_sms_gateway(student.school.settings)
                await gateway.send(parent.phone, message)
```

## Flutter — Chat Screen

```dart
// lib/features/communication/screens/chat_thread_screen.dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ChatThreadScreen extends ConsumerStatefulWidget {
  final String threadId;
  const ChatThreadScreen({super.key, required this.threadId});
  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  late IO.Socket _socket;
  final _messages = <ChatMessage>[];
  final _inputCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initSocket();
    _loadHistory();
  }

  void _initSocket() {
    final token = ref.read(authTokenProvider);
    _socket = IO.io(
      'http://localhost:8000',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );
    _socket.onConnect((_) {
      _socket.emit('join_thread', {'thread_id': widget.threadId});
    });
    _socket.on('new_message', (data) {
      setState(() => _messages.add(ChatMessage.fromJson(data as Map<String, dynamic>)));
    });
  }

  void _sendMessage() {
    final body = _inputCtrl.text.trim();
    if (body.isEmpty) return;
    _socket.emit('send_message', {'thread_id': widget.threadId, 'body': body});
    _inputCtrl.clear();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.threadId)),
    body: Column(children: [
      Expanded(child: ListView.builder(
        reverse: true,
        itemCount: _messages.length,
        itemBuilder: (_, i) => ChatBubble(message: _messages[_messages.length - 1 - i]),
      )),
      Padding(
        padding: const EdgeInsets.all(8),
        child: Row(children: [
          Expanded(child: TextField(controller: _inputCtrl,
              decoration: const InputDecoration(hintText: 'Type a message...'))),
          IconButton(icon: const Icon(Icons.send, color: Color(0xFF1A3C5E)), onPressed: _sendMessage),
        ]),
      ),
    ]),
  );

  @override
  void dispose() { _socket.disconnect(); super.dispose(); }
}
```

## Testing — Phase 6

```python
@pytest.mark.asyncio
async def test_nps_calculation():
    scores = [10, 9, 8, 5, 3, 10, 9, 7, 10, 9]  # 4 promoters, 2 detractors out of 10
    nps = calculate_nps(scores)
    assert nps == pytest.approx(20.0)

@pytest.mark.asyncio
async def test_sms_adapter_msg91_sends(httpx_mock):
    httpx_mock.add_response(url="https://api.msg91.com/api/v5/flow/",
                            json={"request_id": "r123"})
    gw = Msg91Gateway("auth_key", "template_id", "SCHOOL")
    result = await gw.send("+919876543210", "Test message")
    assert result.gateway_ref == "r123"
    assert result.status == "sent"

@pytest.mark.asyncio
async def test_chat_non_participant_cannot_join(socket_client):
    await socket_client.emit("join_thread", {"thread_id": "thread_for_other_school"})
    response = await socket_client.receive()
    assert response.get("error") == "Not a participant"
```

## Antigravity Prompt for Phase 6

```
@file skills/master-plan/SKILL.md
@file skills/phase-06-communication/SKILL.md

Build Phase 6 — Communication:
1. SMS gateway ABC + adapters: Msg91, Fast2SMS, Twilio, Textlocal (factory pattern)
2. WhatsApp gateway ABC + adapters: WaBlas, Ultramsg, Maytapi
3. FastAPI-Mail email service with Jinja2 HTML templates (fee reminder, welcome, notice)
4. python-socketio WebSocket chat: join_thread, send_message, new_message broadcast
5. Mount socket.io as ASGI alongside FastAPI (socket_app wrapper)
6. Survey engine: 9 question types stored as JSONB, NPS calculation, analytics endpoint
7. Celery beat task: daily birthday greetings at 8am per school timezone
8. Celery beat task: engagement creative publisher (stories, tickers, pop-ups)
9. Flutter chat screen: socket_io_client, message bubbles, real-time updates
10. Flutter survey screen: dynamic question renderer for all 9 types
11. All tests: pytest (NPS, SMS mock, socket participant check) + flutter_test
```
