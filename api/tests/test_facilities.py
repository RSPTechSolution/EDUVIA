import pytest
import re
from datetime import datetime
from decimal import Decimal
import uuid
from app.services.library_service import calculate_fine, lookup_isbn
from app.services.hostel_service import allocate_hostel_room, BadRequestException
from app.models.hostel import HostelRoom, HostelAllocation

def test_fine_calculation_overdue():
    due = datetime(2024, 10, 15)
    returned = datetime(2024, 10, 20)  # 5 days late
    fine = calculate_fine(due, returned, rate_per_day=Decimal("2"))
    assert fine == Decimal("10")

def test_fine_zero_on_time():
    due = datetime(2024, 10, 15)
    returned = datetime(2024, 10, 14)
    assert calculate_fine(due, returned, Decimal("2")) == Decimal("0")

@pytest.mark.asyncio
async def test_isbn_lookup_returns_book_data(httpx_mock):
    httpx_mock.add_response(
        url=re.compile(r".*openlibrary\.org.*"),
        json={"ISBN:9780134685991": {"details": {"title": "Effective Java"}}}
    )
    result = await lookup_isbn("9780134685991")
    assert result["title"] == "Effective Java"

class MockSession:
    def __init__(self, room_capacity, current_occupants):
        self.room_capacity = room_capacity
        self.current_occupants = current_occupants

    async def get(self, model, id):
        return HostelRoom(id=id, capacity=self.room_capacity)

    async def scalar(self, stmt):
        return self.current_occupants
        
    def add(self, obj): pass
    async def commit(self): pass

@pytest.mark.asyncio
async def test_hostel_room_at_capacity_rejected():
    db = MockSession(room_capacity=2, current_occupants=2)
    room_id = uuid.uuid4()
    student_id = uuid.uuid4()
    
    with pytest.raises(BadRequestException) as exc:
        await allocate_hostel_room(db, room_id, student_id)
        
    assert exc.value.detail["code"] == "ROOM_FULL"
