from fastapi import APIRouter, Request, Query, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.core.database import get_db
from app.models.attendance import BiometricDevice, BiometricPunch
from app.tasks.attendance_tasks import process_biometric_punches

adms_router = APIRouter()

@adms_router.get("/iclock/cdata", response_class=PlainTextResponse)
async def device_handshake(SN: str = Query(...), db: AsyncSession = Depends(get_db)):
    device = await db.scalar(
        select(BiometricDevice).where(BiometricDevice.device_id == SN, BiometricDevice.is_active == True)
    )
    if not device:
        return PlainTextResponse("Error: Unauthorized device", status_code=403)
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    return PlainTextResponse(f"GET OPTION FROM:{SN}\nATTLOGStamp=9999\nOPERLOGStamp=9999\nATTPHOTO=0\nServerTime={now}\n")

@adms_router.post("/iclock/cdata", response_class=PlainTextResponse)
async def receive_punches(
    request: Request,
    SN: str = Query(...),
    table: str = Query("ATTLOG"),
    db: AsyncSession = Depends(get_db),
):
    if table != "ATTLOG":
        return PlainTextResponse("OK")

    device = await db.scalar(select(BiometricDevice).where(BiometricDevice.device_id == SN))
    if not device:
        return PlainTextResponse("Error", status_code=403)

    body = (await request.body()).decode("utf-8").strip()
    punches = []
    for line in body.split("\n"):
        parts = line.strip().split("\t")
        if len(parts) < 3:
            continue
        person_id, punch_time_str, punch_type = parts[0], parts[1], int(parts[2]) if len(parts) > 2 else 0
        try:
            punch_time = datetime.strptime(punch_time_str.strip(), "%Y-%m-%d %H:%M:%S")
            punches.append(BiometricPunch(
                school_id=device.school_id,
                device_id=SN,
                person_id=person_id.strip(),
                punch_time=punch_time,
                punch_type=punch_type,
            ))
        except ValueError:
            continue

    if punches:
        db.add_all(punches)
        device.last_sync_at = datetime.utcnow()
        await db.commit()
        # Trigger celery task asynchronously
        process_biometric_punches.delay(SN, str(device.school_id))

    return PlainTextResponse("OK")
