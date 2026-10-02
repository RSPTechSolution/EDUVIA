from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.schemas.school import SchoolCreate, SchoolOut
from app.schemas.base import ApiResponse
from app.models.school import School
from app.core.permissions import require_permission

router = APIRouter()

@router.get("/", response_model=ApiResponse[list[SchoolOut]], dependencies=[Depends(require_permission("schools.manage"))])
async def get_schools(db: AsyncSession = Depends(get_db)):
    schools = await db.scalars(select(School))
    return ApiResponse(data=list(schools))

@router.post("/", response_model=ApiResponse[SchoolOut], dependencies=[Depends(require_permission("schools.manage"))])
async def create_school(body: SchoolCreate, db: AsyncSession = Depends(get_db)):
    school = School(**body.model_dump())
    db.add(school)
    await db.commit()
    await db.refresh(school)
@router.get("/library/books")
async def get_books():
    mock_books = [
      { "id": 1, "title": 'The Great Gatsby', "author": 'F. Scott Fitzgerald', "cover_url": 'https://covers.openlibrary.org/b/id/8259441-L.jpg', "available": 3 },
      { "id": 2, "title": 'To Kill a Mockingbird', "author": 'Harper Lee', "cover_url": 'https://covers.openlibrary.org/b/id/8221491-L.jpg', "available": 0 },
    ]
    return {"success": True, "data": mock_books}

@router.get("/hostel/rooms")
async def get_hostel_rooms():
    mock_rooms = [
      { "id": 1, "room_number": '101', "room_type": 'Double AC', "occupancy": 2, "capacity": 2 },
      { "id": 2, "room_number": '102', "room_type": 'Triple Non-AC', "occupancy": 1, "capacity": 3 },
      { "id": 3, "room_number": '103', "room_type": 'Double Non-AC', "occupancy": 0, "capacity": 2 },
    ]
    return {"success": True, "data": mock_rooms}

from pydantic import BaseModel
class GateScanRequest(BaseModel):
    token: str

@router.post("/security/gate/scan")
async def scan_gate_pass(body: GateScanRequest):
    if "approved" in body.token:
        return {"success": True, "data": {"status": "approved", "person": {"name": "Rahul Sharma"}, "message": "Gate Pass Valid"}}
    else:
        return {"success": True, "data": {"status": "rejected", "person": {"name": "Unknown"}, "message": "Invalid Pass"}}

@router.get("/dashboard")
async def get_dashboard_stats():
    import datetime
    now = datetime.datetime.now()
    attendance_data = [{"date": (now - datetime.timedelta(days=(29 - i))).isoformat(), "rate": 70 + (i % 25)} for i in range(30)]
    fee_data = [
      { "name": 'Jan', "tuition_fee": 4000, "transport_fee": 2400, "other_fee": 2400 },
      { "name": 'Feb', "tuition_fee": 3000, "transport_fee": 1398, "other_fee": 2210 },
      { "name": 'Mar', "tuition_fee": 2000, "transport_fee": 9800, "other_fee": 2290 },
    ]
    kpis = { "total_students": 1200, "students_trend": 5, "attendance_rate": 92, "attendance_trend": 2, "fees_today": 45000, "fees_trend": 10, "fees_outstanding": 120000 }
    
    return {"success": True, "data": {"kpis": kpis, "attendance": attendance_data, "fees": fee_data}}

class BroadcastRequest(BaseModel):
    message: str
    channels: list[str]

@router.post("/communication/broadcast")
async def send_broadcast(body: BroadcastRequest):
    return {"success": True, "data": {"message": f"Broadcast sent to {len(body.channels)} channels"}}

class ChatMessage(BaseModel):
    text: str
    recipient_id: str

@router.get("/communication/chat")
async def get_chat_messages():
    mock_messages = [
      { "id": 1, "text": 'Hello, how is my child doing?', "sender": 'other', "time": '10:00 AM' },
      { "id": 2, "text": 'He is doing great in math!', "sender": 'me', "time": '10:05 AM' },
    ]
    return {"success": True, "data": mock_messages}

@router.post("/communication/chat")
async def send_chat_message(body: ChatMessage):
    return {"success": True, "data": {"id": 999, "text": body.text, "sender": 'me', "time": 'Now'}}

@router.get("/analytics")
async def get_analytics_data():
    import datetime
    now = datetime.datetime.now()
    area_data = [{"date": f"Day {i+1}", "value": 70 + (i % 25)} for i in range(30)]
    bar_data = [
      { "name": 'Jan', "tuition": 4000, "transport": 2400 },
      { "name": 'Feb', "tuition": 3000, "transport": 1398 },
      { "name": 'Mar', "tuition": 2000, "transport": 9800 },
    ]
    donut_data = [{"name": 'Male', "value": 550}, {"name": 'Female', "value": 450}]
    stats = {"total_students": 1000, "attendance_rate": 92, "fee_collection": 450000, "pass_rate": 88}
    
    return {"success": True, "data": {"stats": stats, "area": area_data, "bar": bar_data, "donut": donut_data}}
