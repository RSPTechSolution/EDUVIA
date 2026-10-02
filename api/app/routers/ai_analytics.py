from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta
import json
from app.core.dependencies import get_db_session, get_current_user
from app.models.user import User
from app.models.school import School
from app.models.attendance import AttendanceRecord
from app.models.finance import FeePayment
from app.services.ai.intent_classifier import classify_intent, get_llm, ChatPromptTemplate
from app.services.ai.query_templates import execute_intent

router = APIRouter(prefix="/api/v1", tags=["ai_analytics"])

class AiChatRequest(BaseModel):
    message: str

SUMMARIZE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful school ERP assistant. Summarize the following school data "
               "in 2-3 clear sentences. Be specific with numbers. Do not hallucinate — "
               "only use the data provided."),
    ("human", "User asked: {query}\n\nData: {data}"),
])

@router.post("/ai/chat")
async def ai_chat(
    body: AiChatRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    school = await db.get(School, current_user.school_id)
    provider = school.settings.get("ai_provider", "openai") if school and school.settings else "openai"

    intent_result = await classify_intent(body.message, provider)

    data = await execute_intent(db, intent_result.intent, intent_result.params,
                                 current_user.school_id, current_user.role)

    if "error" in data:
        # Mock streaming response with error
        async def err_stream():
            yield f"data: {data['error']}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")

    # Mock streaming for demo without real LLM call
    async def stream_response():
        chunk_content = f"I found some data: {json.dumps(data)[:100]}"
        for word in chunk_content.split():
            yield f"data: {word} \n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")

@router.get("/analytics/dashboard")
async def dashboard_analytics(
    db: AsyncSession = Depends(get_db_session), 
    current_user: User = Depends(get_current_user)
):
    school_id = current_user.school_id
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    # Attendance trend (last 30 days)
    att_trend = await db.execute(
        select(
            AttendanceRecord.date,
            func.count(AttendanceRecord.student_id).filter(AttendanceRecord.status == "present").label("present"),
            func.count(AttendanceRecord.student_id).label("total"),
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

    return {
        "status": "success",
        "data": {
            "attendance_trend": [{"date": str(r.date), "rate": round(r.present/r.total*100,1) if r.total else 0}
                                  for r in att_trend],
            "fee_trend": [{"date": str(r.day.date()), "collected": float(r.collected or 0)} for r in fee_trend],
        }
    }
