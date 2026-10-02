import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db_session
from app.models.transport import TripGpsLog, Sos, Driver
from app.schemas.transport import GpsBatch, SosRequest
from app.core.socket import sio

router = APIRouter(prefix="/api/v1/transport", tags=["transport"])

async def get_current_driver():
    # Mocking driver token verification
    return Driver(id=uuid.uuid4(), school_id=uuid.uuid4(), driver_id="DRV-MOCK")

@router.get("/trips/live")
async def get_live_trips():
    mock_buses = [
      { "id": 1, "route": 'Route A (North)', "vehicle": 'Bus 01', "speed": 42, "status": 'on-time', "passengers": 34, "eta": '10 mins' },
      { "id": 2, "route": 'Route B (East)', "vehicle": 'Bus 04', "speed": 0, "status": 'delayed', "passengers": 41, "eta": '25 mins' },
    ]
    return {"success": True, "data": mock_buses}

@router.post("/trips/{trip_id}/gps")
async def receive_gps_batch(
    trip_id: uuid.UUID,
    data: GpsBatch,
    db: AsyncSession = Depends(get_db_session),
    current_driver = Depends(get_current_driver)
):
    logs = [TripGpsLog(trip_id=trip_id, lat=p.lat, lng=p.lng, speed=p.speed) for p in data.pings]
    db.add_all(logs)
    await db.commit()

    if data.pings:
        last = data.pings[-1]
        await sio.emit("trip_update", {
            "trip_id": str(trip_id),
            "lat": float(last.lat),
            "lng": float(last.lng),
            "speed": float(last.speed or 0)
        }, room="transport_live")

    return {"success": True, "data": {"saved": len(logs)}}

@router.post("/sos")
async def send_sos(
    body: SosRequest,
    db: AsyncSession = Depends(get_db_session),
    current_driver = Depends(get_current_driver)
):
    sos = Sos(driver_id=current_driver.id, trip_id=body.trip_id,
              lat=body.lat, lng=body.lng, school_id=current_driver.school_id)
    db.add(sos)
    await db.commit()
    # Mock Firebase push to admins
    return {"success": True, "data": {"message": "SOS sent"}}
