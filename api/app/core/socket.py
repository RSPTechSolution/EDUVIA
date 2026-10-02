import socketio
from jose import jwt, JWTError
from app.core.config import settings
from app.services.chat_service import save_message, get_thread_participants

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

def decode_token_socket(token: str):
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise ValueError("Invalid token")

@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token") if auth else None
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Unauthorized")
    try:
        user = decode_token_socket(token)
        await sio.save_session(sid, {"user_id": user["sub"], "school_id": user.get("school_id")})
    except Exception:
        raise socketio.exceptions.ConnectionRefusedError("Invalid token")

@sio.event
async def join_thread(sid, data):
    thread_id = data.get("thread_id")
    session = await sio.get_session(sid)
    participants = await get_thread_participants(thread_id)
    if str(session["user_id"]) not in participants:
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
    await sio.emit("new_message", {"id": str(msg.id), "body": msg.body, "sender_id": str(msg.sender_id)}, room=f"thread_{thread_id}")
    # (Mock Firebase push here)
