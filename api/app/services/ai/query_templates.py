import uuid
from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.finance import FeeInvoice
from app.models.academics import Student
from app.models.attendance import AttendanceRecord

INTENT_ROLES = {
    "fee.outstanding":      ["school_admin", "accountant", "principal"],
    "fee.collected_today":  ["school_admin", "accountant", "principal"],
    "fee.defaulters":       ["school_admin", "accountant"],
    "attendance.low":       ["school_admin", "principal", "teacher"],
    "attendance.today":     ["school_admin", "principal", "teacher"],
    "student.count":        ["school_admin", "principal", "teacher", "accountant"],
    "exam.top_performers":  ["school_admin", "principal", "teacher"],
    "staff.present_today":  ["school_admin", "principal"],
    "general.greeting":     ["*"],
    "general.unknown":      ["*"],
}

async def execute_intent(
    db: AsyncSession, intent: str, params: dict,
    school_id: uuid.UUID, user_role: str,
) -> dict:
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
        return {"items": [{"id": str(r.id), "total": float(r.total_amount)} for r in rows.all()], "type": "fee_list"}

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
        total = total or 0
        present = present or 0
        return {"type": "attendance_summary", "date": str(today), "total": total, "present": present,
                "absent": total - present, "rate": round(present / total * 100, 1) if total else 0}

    elif intent == "general.greeting":
        return {"type": "greeting"}

    elif intent == "general.unknown":
        return {"type": "unknown"}

    return {"type": "empty", "message": "No data found"}
