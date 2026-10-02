import secrets
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.security import GatePass, GateLog
from fastapi import HTTPException

class BadRequestException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=400, detail=detail)

async def approve_gate_pass(db: AsyncSession, pass_id: uuid.UUID, approved_by: uuid.UUID) -> GatePass:
    gate_pass = await db.get(GatePass, pass_id)
    if not gate_pass or gate_pass.status != "pending":
        raise BadRequestException("Pass not in pending state")

    qr_token = secrets.token_urlsafe(32)
    gate_pass.status = "approved"
    gate_pass.approved_by = approved_by
    gate_pass.approved_at = datetime.utcnow()
    gate_pass.qr_token = qr_token
    await db.commit()
    
    # SMS logic mocked here
    return gate_pass

async def scan_gate_pass_qr(db: AsyncSession, qr_token: str, logged_by: uuid.UUID) -> dict:
    gate_pass = await db.scalar(select(GatePass).where(GatePass.qr_token == qr_token))
    if not gate_pass:
        return {"status": "invalid", "message": "QR code not found"}
    if gate_pass.status != "approved":
        return {"status": "rejected", "message": f"Pass is {gate_pass.status}"}
    if gate_pass.used_at:
        return {"status": "rejected", "message": "Pass already used"}

    gate_pass.used_at = datetime.utcnow()
    gate_pass.status = "used"

    log = GateLog(
        school_id=gate_pass.school_id, 
        gate_pass_id=gate_pass.id,
        person_id=gate_pass.requested_for, 
        person_type="student" if gate_pass.pass_type == "student_exit" else "staff",
        direction="out", 
        method="qr", 
        logged_by=logged_by
    )
    db.add(log)
    await db.commit()
    
    return {"status": "approved", "message": "Approved", "pass": gate_pass}
