"""Late fees and reminders (under /fees), and the school accounts (/accounts)."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.schemas.accounts import (
    AccountsSummary, EntryIn, EntryOut, HeadIn, HeadOut, LateFeeResult, LateFeeRule, ReminderRequest, ReminderResult,
)
from app.schemas.common import ApiResponse, Message, PageParams, ok
from app.services import accounts_service as svc

fees = APIRouter(dependencies=[require_module("fees")])
accounts = APIRouter(dependencies=[require_module("accounts")])


@fees.get("/late-fee-rule", response_model=ApiResponse[LateFeeRule])
async def late_rule(db: DB, current: CurrentUser = require_permission("fees.view")):
    return ok(await svc.get_rule(db, current.require_school()))


@fees.put("/late-fee-rule", response_model=ApiResponse[LateFeeRule])
async def set_late_rule(body: LateFeeRule, db: DB, current: CurrentUser = require_permission("fees.manage")):
    current.require_school()
    return ok(await svc.set_rule(db, current.user, body))


@fees.post("/late-fees/apply", response_model=ApiResponse[LateFeeResult])
async def apply_late(db: DB, current: CurrentUser = require_permission("fees.manage")):
    current.require_school()
    return ok(await svc.apply_late_fees(db, current.user))


@fees.post("/invoices/{invoice_id}/waive-late-fee", response_model=ApiResponse[Message])
async def waive(invoice_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("fees.manage")):
    current.require_school()
    await svc.waive_late_fee(db, current.user, invoice_id)
    return ok(Message(message="Late fee waived"))


@fees.post("/reminders", response_model=ApiResponse[ReminderResult])
async def reminders(body: ReminderRequest, db: DB, current: CurrentUser = require_permission("fees.collect")):
    current.require_school()
    return ok(await svc.send_reminders(db, current.user, body))


# ---- accounts ---------------------------------------------------------------------------------

@accounts.get("/heads", response_model=ApiResponse[list[HeadOut]])
async def heads(db: DB, current: CurrentUser = require_permission("accounts.view")):
    current.require_school()
    return ok(await svc.list_heads(db, current.user))


@accounts.post("/heads", response_model=ApiResponse[HeadOut], status_code=201)
async def add_head(body: HeadIn, db: DB, current: CurrentUser = require_permission("accounts.manage")):
    current.require_school()
    return ok(await svc.save_head(db, current.user, body))


@accounts.put("/heads/{head_id}", response_model=ApiResponse[HeadOut])
async def edit_head(head_id: uuid.UUID, body: HeadIn, db: DB, current: CurrentUser = require_permission("accounts.manage")):
    current.require_school()
    return ok(await svc.save_head(db, current.user, body, head_id))


@accounts.get("/entries", response_model=ApiResponse[list[EntryOut]])
async def entries(db: DB, page: PageParams = Depends(), start: date = Query(alias="from"), end: date = Query(alias="to"),
                  kind: str | None = None, head_id: uuid.UUID | None = None, search: str | None = None,
                  current: CurrentUser = require_permission("accounts.view")):
    current.require_school()
    rows, meta = await svc.list_entries(db, current.user, page, start=start, end=end, kind=kind, head_id=head_id, search=search)
    return ok(rows, meta)


@accounts.post("/entries", response_model=ApiResponse[EntryOut], status_code=201)
async def add_entry(body: EntryIn, db: DB, current: CurrentUser = require_permission("accounts.manage")):
    current.require_school()
    return ok(await svc.create_entry(db, current.user, body))


@accounts.put("/entries/{entry_id}", response_model=ApiResponse[EntryOut])
async def edit_entry(entry_id: uuid.UUID, body: EntryIn, db: DB, current: CurrentUser = require_permission("accounts.manage")):
    current.require_school()
    return ok(await svc.update_entry(db, current.user, entry_id, body))


@accounts.delete("/entries/{entry_id}", response_model=ApiResponse[Message])
async def delete_entry(entry_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("accounts.manage")):
    current.require_school()
    await svc.delete_entry(db, current.user, entry_id)
    return ok(Message(message="Entry deleted"))


@accounts.get("/summary", response_model=ApiResponse[AccountsSummary])
async def summary(db: DB, start: date = Query(alias="from"), end: date = Query(alias="to"),
                  current: CurrentUser = require_permission("accounts.view")):
    current.require_school()
    return ok(await svc.summary(db, current.user, start, end))


@accounts.get("/export/tally.xml")
async def tally(db: DB, start: date = Query(alias="from"), end: date = Query(alias="to"), current: CurrentUser = require_permission("accounts.view")):
    current.require_school()
    xml = await svc.tally_xml(db, current.user, start, end)
    return Response(xml, media_type="application/xml",
                    headers={"Content-Disposition": f'attachment; filename="tally-vouchers-{start}-to-{end}.xml"'})


@accounts.get("/export/daybook.csv")
async def daybook(db: DB, start: date = Query(alias="from"), end: date = Query(alias="to"), current: CurrentUser = require_permission("accounts.view")):
    current.require_school()
    csv = await svc.daybook_csv(db, current.user, start, end)
    return Response(csv, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="daybook-{start}-to-{end}.csv"'})
