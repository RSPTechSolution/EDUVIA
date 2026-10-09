"""Library, hostel, inventory and assets. Each is its own module and router."""
import uuid
from typing import Literal

from fastapi import APIRouter, Query

from app.core.deps import DB, Auth, CurrentUser, require_module, require_permission
from app.schemas.campus import (
    AllocateIn, AssetIn, AssetOut, BookIn, BookOut, HostelIn, HostelOut, IssueIn, IssueOut, ItemIn, ItemOut, LibrarySettings, LibraryStats, MoveIn,
    MoveOut, ReturnIn, RoomIn,
)
from app.schemas.common import ApiResponse, Message, ok
from app.services import campus_service as svc

library = APIRouter(dependencies=[require_module("library")])
hostel = APIRouter(dependencies=[require_module("hostel")])
inventory = APIRouter(dependencies=[require_module("inventory")])


# ---- library ----------------------------------------------------------------------------------

@library.get("/stats", response_model=ApiResponse[LibraryStats])
async def lib_stats(db: DB, current: CurrentUser = require_permission("library.view")):
    current.require_school()
    return ok(await svc.stats(db, current.user))


@library.get("/settings", response_model=ApiResponse[LibrarySettings])
async def lib_settings(db: DB, current: CurrentUser = require_permission("library.view")):
    current.require_school()
    return ok(await svc.library_settings(db, current.user.school_id))


@library.put("/settings", response_model=ApiResponse[LibrarySettings])
async def save_lib_settings(body: LibrarySettings, db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.save_library_settings(db, current.user, body))


@library.get("/books", response_model=ApiResponse[list[BookOut]])
async def books(db: DB, q: str | None = Query(None, max_length=100), category: str | None = None,
                current: CurrentUser = require_permission("library.view")):
    current.require_school()
    return ok(await svc.search_books(db, current.user, q, category))


@library.post("/books", response_model=ApiResponse[BookOut], status_code=201)
async def add_book(body: BookIn, db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.save_book(db, current.user, body))


@library.get("/books/{bid}", response_model=ApiResponse[BookOut])
async def book(bid: uuid.UUID, db: DB, current: CurrentUser = require_permission("library.view")):
    current.require_school()
    return ok(await svc.book_detail(db, current.user, bid))


@library.put("/books/{bid}", response_model=ApiResponse[BookOut])
async def edit_book(bid: uuid.UUID, body: BookIn, db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.save_book(db, current.user, body, bid))


@library.get("/issues", response_model=ApiResponse[list[IssueOut]])
async def issue_list(db: DB, status: Literal["open", "overdue", "fines", "all"] = "open", current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.issues(db, current.user, status))


@library.post("/issue", response_model=ApiResponse[IssueOut], status_code=201)
async def issue(body: IssueIn, db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.issue(db, current.user, body.accession_no, body.borrower, body.days))


@library.post("/return", response_model=ApiResponse[IssueOut])
async def return_book(body: ReturnIn, db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.return_book(db, current.user, body.accession_no, body.fine_paid, body.condition))


@library.post("/issues/{iid}/fine-paid", response_model=ApiResponse[IssueOut])
async def fine_paid(iid: uuid.UUID, db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    return ok(await svc.mark_fine_paid(db, current.user, iid))


@library.post("/remind-overdue", response_model=ApiResponse[Message])
async def remind(db: DB, current: CurrentUser = require_permission("library.manage")):
    current.require_school()
    n = await svc.remind_overdue(db, current.user)
    return ok(Message(message=f"Reminded {n} borrower(s)" if n else "Nothing is overdue"))


@library.get("/mine", response_model=ApiResponse[list[IssueOut]])
async def mine(db: DB, current: Auth):
    current.require_school()
    return ok(await svc.my_books(db, current.user))


# ---- hostel -----------------------------------------------------------------------------------

@hostel.get("", response_model=ApiResponse[list[HostelOut]])
async def hostels(db: DB, current: CurrentUser = require_permission("hostel.view")):
    current.require_school()
    return ok(await svc.list_hostels(db, current.user))


@hostel.post("", response_model=ApiResponse[HostelOut], status_code=201)
async def add_hostel(body: HostelIn, db: DB, current: CurrentUser = require_permission("hostel.manage")):
    current.require_school()
    return ok(await svc.save_hostel(db, current.user, body))


@hostel.get("/mine", response_model=ApiResponse[list[dict]])
async def my_hostel(db: DB, current: Auth):
    current.require_school()
    return ok(await svc.my_hostel(db, current.user))


@hostel.post("/allocations", response_model=ApiResponse[HostelOut], status_code=201)
async def allocate(body: AllocateIn, db: DB, current: CurrentUser = require_permission("hostel.manage")):
    current.require_school()
    return ok(await svc.allocate(db, current.user, body.student_id, body.room_id, body.from_date, body.note))


@hostel.post("/allocations/{aid}/vacate", response_model=ApiResponse[Message])
async def vacate(aid: uuid.UUID, db: DB, current: CurrentUser = require_permission("hostel.manage")):
    current.require_school()
    await svc.vacate(db, current.user, aid)
    return ok(Message(message="Bed vacated"))


@hostel.get("/{hid}", response_model=ApiResponse[HostelOut])
async def hostel_detail(hid: uuid.UUID, db: DB, current: CurrentUser = require_permission("hostel.view")):
    current.require_school()
    return ok(await svc.hostel_detail(db, current.user, hid))


@hostel.put("/{hid}", response_model=ApiResponse[HostelOut])
async def edit_hostel(hid: uuid.UUID, body: HostelIn, db: DB, current: CurrentUser = require_permission("hostel.manage")):
    current.require_school()
    return ok(await svc.save_hostel(db, current.user, body, hid))


@hostel.post("/{hid}/rooms", response_model=ApiResponse[HostelOut], status_code=201)
async def add_room(hid: uuid.UUID, body: RoomIn, db: DB, current: CurrentUser = require_permission("hostel.manage")):
    current.require_school()
    return ok(await svc.add_room(db, current.user, hid, body))


# ---- inventory and assets ---------------------------------------------------------------------

@inventory.get("/items", response_model=ApiResponse[list[ItemOut]])
async def items(db: DB, low: bool = False, current: CurrentUser = require_permission("inventory.view")):
    current.require_school()
    return ok(await svc.list_items(db, current.user, low))


@inventory.post("/items", response_model=ApiResponse[ItemOut], status_code=201)
async def add_item(body: ItemIn, db: DB, current: CurrentUser = require_permission("inventory.manage")):
    current.require_school()
    return ok(await svc.save_item(db, current.user, body))


@inventory.put("/items/{iid}", response_model=ApiResponse[ItemOut])
async def edit_item(iid: uuid.UUID, body: ItemIn, db: DB, current: CurrentUser = require_permission("inventory.manage")):
    current.require_school()
    return ok(await svc.save_item(db, current.user, body, iid))


@inventory.post("/items/{iid}/moves", response_model=ApiResponse[ItemOut], status_code=201)
async def move(iid: uuid.UUID, body: MoveIn, db: DB, current: CurrentUser = require_permission("inventory.manage")):
    current.require_school()
    return ok(await svc.move(db, current.user, iid, body))


@inventory.get("/items/{iid}/moves", response_model=ApiResponse[list[MoveOut]])
async def moves(iid: uuid.UUID, db: DB, current: CurrentUser = require_permission("inventory.view")):
    current.require_school()
    return ok(await svc.moves(db, current.user, iid))


@inventory.get("/assets", response_model=ApiResponse[list[AssetOut]])
async def assets(db: DB, q: str | None = Query(None, max_length=100), condition: str | None = None,
                 current: CurrentUser = require_permission("inventory.view")):
    current.require_school()
    return ok(await svc.list_assets(db, current.user, q, condition))


@inventory.post("/assets", response_model=ApiResponse[AssetOut], status_code=201)
async def add_asset(body: AssetIn, db: DB, current: CurrentUser = require_permission("inventory.manage")):
    current.require_school()
    return ok(await svc.save_asset(db, current.user, body))


@inventory.put("/assets/{aid}", response_model=ApiResponse[AssetOut])
async def edit_asset(aid: uuid.UUID, body: AssetIn, db: DB, current: CurrentUser = require_permission("inventory.manage")):
    current.require_school()
    return ok(await svc.save_asset(db, current.user, body, aid))
