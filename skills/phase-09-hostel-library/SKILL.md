---
name: schoolerp-phase-09-hostel-library
description: >
  Phase 9 of SchoolERP (Python + Flutter) — library (ISBN lookup via Open Library API,
  barcode issue/return, fine calculation), hostel (room hierarchy, capacity enforcement,
  hostel attendance), inventory (stock, purchase orders, low-stock Celery alert),
  asset management (register, QR, maintenance). Use for library, hostel, inventory or assets.
---
# Phase 9 — Library, Hostel, Inventory & Assets
## Python FastAPI · Celery · Flutter

## SQLAlchemy Models

```python
# api/app/models/library.py
class Book(Base):
    __tablename__ = "books"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    author: Mapped[str] = mapped_column(String(200))
    publisher: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

class BookCopy(Base):
    __tablename__ = "book_copies"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id"))
    barcode: Mapped[str] = mapped_column(String(100), unique=True)
    condition: Mapped[str] = mapped_column(String(20), default="good")
    is_available: Mapped[bool] = mapped_column(default=True)

class BookIssue(Base):
    __tablename__ = "book_issues"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    copy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("book_copies.id"))
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # student or staff
    member_type: Mapped[str] = mapped_column(String(10))  # student|staff
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fine: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="issued")  # issued|returned|overdue|lost

class HostelRoom(Base):
    __tablename__ = "hostel_rooms"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    block: Mapped[str] = mapped_column(String(50))
    floor: Mapped[str] = mapped_column(String(10))
    room_number: Mapped[str] = mapped_column(String(20))
    room_type: Mapped[str] = mapped_column(String(20))  # single|double|dormitory
    capacity: Mapped[int] = mapped_column()
    __table_args__ = (UniqueConstraint("school_id", "block", "floor", "room_number"),)

class HostelAllocation(Base):
    __tablename__ = "hostel_allocations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id"))
    allocated_from: Mapped[date] = mapped_column(Date)
    allocated_to: Mapped[date | None] = mapped_column(Date, nullable=True)

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(20))  # pieces|kg|litre|box
    current_stock: Mapped[int] = mapped_column(default=0)
    reorder_level: Mapped[int] = mapped_column(default=10)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)

class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    purchase_date: Mapped[date] = mapped_column(Date)
    purchase_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    current_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    qr_code: Mapped[str] = mapped_column(String(200), unique=True)
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
```

## ISBN Lookup Service (Open Library API)

```python
# api/app/services/library_service.py
import httpx

async def lookup_isbn(isbn: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=details")
        if not res.is_success:
            return None
        data = res.json()
        key = f"ISBN:{isbn}"
        if key not in data:
            return None
        details = data[key].get("details", {})
        return {
            "title": details.get("title", ""),
            "authors": [a.get("name", "") for a in details.get("authors", [])],
            "publisher": details.get("publishers", [{}])[0].get("name", ""),
            "cover_url": f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg",
        }

def calculate_fine(due_date: datetime, returned_at: datetime, rate_per_day: Decimal) -> Decimal:
    if returned_at <= due_date:
        return Decimal("0")
    overdue_days = (returned_at.date() - due_date.date()).days
    return Decimal(overdue_days) * rate_per_day

async def allocate_hostel_room(db: AsyncSession, room_id: uuid.UUID, student_id: uuid.UUID):
    room = await db.get(HostelRoom, room_id)
    current_occupants = await db.scalar(
        select(func.count()).where(
            HostelAllocation.room_id == room_id,
            HostelAllocation.allocated_to == None,
        )
    )
    if current_occupants >= room.capacity:
        raise BadRequestException(detail={"code": "ROOM_FULL", "message": f"Room capacity ({room.capacity}) reached"})
    allocation = HostelAllocation(student_id=student_id, room_id=room_id, allocated_from=date.today())
    db.add(allocation)
    await db.commit()
    return allocation
```

## Low-Stock Celery Alert

```python
# api/app/tasks/inventory_tasks.py
@shared_task
def check_low_stock():
    """Runs daily. Sends alerts for items below reorder level."""
    import asyncio
    asyncio.run(_check())

async def _check():
    async with AsyncSessionLocal() as db:
        low_items = await db.scalars(
            select(InventoryItem).where(InventoryItem.current_stock <= InventoryItem.reorder_level)
        )
        for item in low_items.all():
            school = await db.get(School, item.school_id)
            gateway = get_sms_gateway(school.settings)
            admin_phones = await get_admin_phones(db, item.school_id)
            for phone in admin_phones:
                await gateway.send(phone, f"⚠️ Low stock alert: {item.name} has {item.current_stock} {item.unit} left (reorder at {item.reorder_level})")
```

## Flutter — Library Screen

```dart
// lib/features/library/screens/issue_book_screen.dart
// Uses mobile_scanner to scan book barcode
// Looks up copy → shows book title + due date picker
// Issue button → POST /api/v1/library/issues

// lib/features/library/screens/isbn_lookup_screen.dart
// Text field for ISBN → GET /api/v1/library/isbn-lookup/{isbn}
// Shows book details from Open Library, "Add to Catalog" button
```

## Testing — Phase 9

```python
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
async def test_hostel_room_at_capacity_rejected(db):
    room = await create_room(db, capacity=2)
    await allocate_hostel_room(db, room.id, STUDENT_1)
    await allocate_hostel_room(db, room.id, STUDENT_2)
    with pytest.raises(BadRequestException) as exc:
        await allocate_hostel_room(db, room.id, STUDENT_3)
    assert exc.value.detail["code"] == "ROOM_FULL"

@pytest.mark.asyncio
async def test_isbn_lookup_returns_book_data(httpx_mock):
    httpx_mock.add_response(url=re.compile(r"openlibrary.org"),
                            json={"ISBN:9780134685991": {"details": {"title": "Effective Java"}}})
    result = await lookup_isbn("9780134685991")
    assert result["title"] == "Effective Java"
```

## Antigravity Prompt for Phase 9

```
@file skills/master-plan/SKILL.md
@file skills/phase-09-hostel-library/SKILL.md

Build Phase 9:
1. All SQLAlchemy models + Alembic migration
2. Library: httpx ISBN lookup from Open Library API, barcode-based issue/return,
   fine calculator, reservation queue, catalog CRUD
3. Hostel: room CRUD with capacity enforcement (raise ROOM_FULL), allocation with transfer
4. Inventory: stock management, purchase orders, issuance to departments
5. Celery beat task: daily low-stock check → SMS to school admins
6. Asset management: register, QR generation (qrcode library), maintenance log
7. Flutter library screen: mobile_scanner barcode scan → issue book flow
8. Flutter hostel screen: room grid with occupancy indicators, allocation dialog
9. All tests: pytest (fine calculation, room capacity, ISBN lookup mock) + flutter_test
```
