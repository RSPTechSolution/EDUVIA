"""Late fees, fee reminders, and the school's accounts (day book, income vs expense, Tally export)."""
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from xml.sax.saxutils import escape

from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models import (
    AccountEntry, FeeInvoice, FeeInvoiceItem, FeePayment, LedgerHead, School, SchoolClass, Section, Student, StudentGuardian,
    StoredFile, User,
)
from app.schemas.accounts import (
    AccountsSummary, EntryIn, EntryOut, HeadIn, HeadOut, HeadTotal, LateFeeResult, LateFeeRule, MonthTotal, ReminderRequest,
    ReminderResult,
)
from app.schemas.common import PageMeta, PageParams
from app.services import audit_service, email_service, email_templates, notification_service, sms_service, storage_service
from app.services.academics_service import field_error
from app.services.fee_service import _status, academic_year, balance
from app.services.family_service import school_today

ZERO = Decimal(0)
LATE_FEE = "Late fee"
DEFAULT_HEADS = {
    "income": ["Donations", "Canteen and shop rent", "Bus hire", "Interest", "Other income"],
    "expense": ["Salaries", "Electricity and water", "Maintenance and repairs", "Stationery and printing", "Transport fuel",
                "Events and functions", "Internet and phone", "Other expenses"],
}
METHODS = {"cash": "Cash", "bank_transfer": "Bank transfer", "upi": "UPI", "cheque": "Cheque", "card": "Card", "online": "Online"}


# ---- late fees --------------------------------------------------------------------------------

async def get_rule(db: AsyncSession, school_id: uuid.UUID) -> LateFeeRule:
    school = await db.get(School, school_id)
    return LateFeeRule(**((school.settings or {}).get("late_fee") or {}))


async def set_rule(db: AsyncSession, user: User, rule: LateFeeRule) -> LateFeeRule:
    school = await db.get(School, user.school_id)
    school.settings = {**(school.settings or {}), "late_fee": rule.model_dump(mode="json")}
    await audit_service.record(db, "fees.late_fee_rule", school_id=user.school_id, user_id=user.id, entity_type="school",
                               entity_id=school.id, meta=rule.model_dump(mode="json"))
    return rule


def late_fee_for(rule: LateFeeRule, due: date, today: date) -> Decimal:
    days = (today - due).days - rule.grace_days
    if not rule.enabled or days <= 0:
        return ZERO
    fee = rule.amount if rule.mode == "flat" else rule.amount * days
    if rule.max_amount is not None and rule.max_amount > 0:
        fee = min(fee, rule.max_amount)
    return fee.quantize(Decimal("0.01"), ROUND_HALF_UP)


async def apply_late_fees(db: AsyncSession, user: User) -> LateFeeResult:
    """Bring every overdue invoice's late fee up to date (it never goes down, and paid invoices are left alone)."""
    rule = await get_rule(db, user.school_id)
    if not rule.enabled:
        raise Conflict("Turn on the late fee rule first", code="LATE_FEE_OFF")
    today = await school_today(db, user.school_id)
    rows = (await db.scalars(select(FeeInvoice).where(FeeInvoice.school_id == user.school_id, FeeInvoice.due_date < today,
                                                      FeeInvoice.status.in_(("unpaid", "partial"))))).all()
    count, added = 0, ZERO
    for inv in rows:
        fee = late_fee_for(rule, inv.due_date, today)
        delta = fee - inv.late_fee
        if delta <= 0:
            continue
        item = await db.scalar(select(FeeInvoiceItem).where(FeeInvoiceItem.invoice_id == inv.id, FeeInvoiceItem.name == LATE_FEE,
                                                            FeeInvoiceItem.category_id.is_(None)))
        if item:
            item.amount += delta
        else:
            db.add(FeeInvoiceItem(school_id=inv.school_id, invoice_id=inv.id, category_id=None, name=LATE_FEE, amount=delta))
        inv.late_fee, inv.total = fee, inv.total + delta
        inv.status = _status(inv)
        count, added = count + 1, added + delta
    await db.flush()
    await audit_service.record(db, "fees.late_fees", school_id=user.school_id, user_id=user.id, entity_type="school",
                               entity_id=user.school_id, meta={"invoices": count, "added": float(added)})
    return LateFeeResult(invoices=count, added=added)


async def waive_late_fee(db: AsyncSession, user: User, invoice_id: uuid.UUID) -> None:
    inv = await db.scalar(select(FeeInvoice).where(FeeInvoice.id == invoice_id, FeeInvoice.school_id == user.school_id))
    if not inv:
        raise NotFound("Invoice not found")
    if not inv.late_fee:
        return
    if inv.total - inv.late_fee - inv.discount < inv.paid:
        raise Conflict("Payments already cover part of the late fee; give a discount instead", code="LATE_FEE_PAID")
    item = await db.scalar(select(FeeInvoiceItem).where(FeeInvoiceItem.invoice_id == inv.id, FeeInvoiceItem.name == LATE_FEE,
                                                        FeeInvoiceItem.category_id.is_(None)))
    if item:
        await db.delete(item)
    await audit_service.record(db, "fees.late_fee_waived", school_id=user.school_id, user_id=user.id, entity_type="fee_invoice",
                               entity_id=inv.id, meta={"amount": float(inv.late_fee), "invoice_no": inv.invoice_no})
    inv.total -= inv.late_fee
    inv.late_fee = ZERO
    inv.status = _status(inv)
    await db.flush()


# ---- reminders --------------------------------------------------------------------------------

async def send_reminders(db: AsyncSession, user: User, data: ReminderRequest) -> ReminderResult:
    today = await school_today(db, user.school_id)
    school = await db.get(School, user.school_id)
    q = (select(FeeInvoice, Student, SchoolClass.name, Section.name).join(Student, Student.id == FeeInvoice.student_id)
         .join(SchoolClass, SchoolClass.id == Student.class_id).join(Section, Section.id == Student.section_id)
         .where(FeeInvoice.school_id == user.school_id, FeeInvoice.status.in_(("unpaid", "partial")), Student.status == "active"))
    if data.overdue_only:
        q = q.where(FeeInvoice.due_date < today)
    if data.class_id:
        q = q.where(Student.class_id == data.class_id)
    if data.section_id:
        q = q.where(Student.section_id == data.section_id)
    if data.term:
        q = q.where(FeeInvoice.term == data.term)
    rows = (await db.execute(q)).all()
    recent = datetime.now(UTC) - timedelta(days=3)
    sent, skipped, emails, families = 0, 0, 0, set()
    for inv, s, cname, sname in rows:
        if inv.last_reminded_at and inv.last_reminded_at > recent:
            skipped += 1
            continue
        due = balance(inv)
        if due <= 0:
            continue
        overdue = inv.due_date < today
        to = await notification_service.family_of(db, [s.id])
        families.update(to)
        await notification_service.notify(
            db, to, school_id=user.school_id, kind="fee_reminder",
            title=f"{'Overdue' if overdue else 'Due'}: ₹{due:,.0f} for {s.first_name}", body=f"{inv.term} · due {inv.due_date:%d %b %Y}",
            link="/my-fees", data={"invoice_id": inv.id})
        for email, name in (await db.execute(select(User.email, User.full_name).join(StudentGuardian, StudentGuardian.user_id == User.id)
                                             .where(StudentGuardian.student_id == s.id, User.is_active.is_(True)))).all():
            await email_service.queue(db, email_templates.fee_reminder(
                to=email, name=name, school_name=school.name, student=f"{s.first_name} {s.last_name}", class_section=f"{cname} – {sname}",
                term=inv.term, due_date=inv.due_date, balance=due, overdue=overdue, late_fee=inv.late_fee), school_id=school.id)
            emails += 1
        await sms_service.queue(db, school_id=user.school_id, event_name="fee_reminder", phones=await sms_service.family_phones(db, [s.id]),
                                body=f"{school.name}: Rs. {due:,.0f} school fees for {s.first_name} ({inv.term}) "
                                     f"{'were due on' if overdue else 'are due by'} {inv.due_date:%d %b}. Please ignore if already paid.")
        inv.last_reminded_at = datetime.now(UTC)
        sent += 1
    await db.flush()
    await audit_service.record(db, "fees.reminders", school_id=user.school_id, user_id=user.id, entity_type="school",
                               entity_id=user.school_id, meta={"invoices": sent, "emails": emails, "overdue_only": data.overdue_only})
    return ReminderResult(invoices=sent, families=len(families), emails=emails, skipped_recent=skipped)


# ---- heads ------------------------------------------------------------------------------------

async def ensure_heads(db: AsyncSession, school_id: uuid.UUID) -> None:
    if await db.scalar(select(LedgerHead.id).where(LedgerHead.school_id == school_id).limit(1)):
        return
    for kind, names in DEFAULT_HEADS.items():
        for n in names:
            db.add(LedgerHead(school_id=school_id, kind=kind, name=n))
    await db.flush()


async def list_heads(db: AsyncSession, user: User) -> list[HeadOut]:
    await ensure_heads(db, user.school_id)
    today = await school_today(db, user.school_id)
    start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
    totals = dict((await db.execute(select(AccountEntry.head_id, func.sum(AccountEntry.amount)).where(
        AccountEntry.school_id == user.school_id, AccountEntry.date >= start).group_by(AccountEntry.head_id))).all())
    heads = (await db.scalars(select(LedgerHead).where(LedgerHead.school_id == user.school_id).order_by(LedgerHead.kind, LedgerHead.name))).all()
    return [HeadOut(id=h.id, kind=h.kind, name=h.name, is_active=h.is_active, total_this_year=totals.get(h.id) or ZERO) for h in heads]


async def save_head(db: AsyncSession, user: User, data: HeadIn, head_id: uuid.UUID | None = None) -> HeadOut:
    clash = await db.scalar(select(LedgerHead.id).where(LedgerHead.school_id == user.school_id, LedgerHead.kind == data.kind,
                                                        func.lower(LedgerHead.name) == data.name.lower(), LedgerHead.id != head_id))
    if clash:
        raise field_error("name", "There is already a head with this name")
    if head_id:
        h = await db.scalar(select(LedgerHead).where(LedgerHead.id == head_id, LedgerHead.school_id == user.school_id))
        if not h:
            raise NotFound("Head not found")
        if h.kind != data.kind and await db.scalar(select(AccountEntry.id).where(AccountEntry.head_id == h.id).limit(1)):
            raise field_error("kind", "This head has entries, so it can't switch between income and expense")
        h.kind, h.name, h.is_active = data.kind, data.name, data.is_active
    else:
        h = LedgerHead(school_id=user.school_id, **data.model_dump())
        db.add(h)
    await db.flush()
    return HeadOut(id=h.id, kind=h.kind, name=h.name, is_active=h.is_active)


# ---- entries ----------------------------------------------------------------------------------

async def _entries_out(db: AsyncSession, rows: list[AccountEntry]) -> list[EntryOut]:
    heads = dict((await db.execute(select(LedgerHead.id, LedgerHead.name).where(LedgerHead.id.in_({r.head_id for r in rows})))).all())
    users = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_({r.created_by for r in rows if r.created_by})))).all())
    files = dict((await db.execute(select(StoredFile.owner_id, func.count()).where(
        StoredFile.purpose == "voucher", StoredFile.owner_id.in_([r.id for r in rows])).group_by(StoredFile.owner_id))).all())
    return [EntryOut(id=r.id, voucher_no=r.voucher_no, kind=r.kind, head_id=r.head_id, head_name=heads.get(r.head_id, ""), date=r.date,
                     amount=r.amount, party=r.party, method=r.method, reference=r.reference, note=r.note,
                     created_by=users.get(r.created_by), created_at=r.created_at, attachments=files.get(r.id, 0)) for r in rows]


async def list_entries(db: AsyncSession, user: User, page: PageParams, *, start: date, end: date, kind: str | None,
                       head_id: uuid.UUID | None, search: str | None) -> tuple[list[EntryOut], PageMeta]:
    q = select(AccountEntry).where(AccountEntry.school_id == user.school_id, AccountEntry.date >= start, AccountEntry.date <= end)
    if kind:
        q = q.where(AccountEntry.kind == kind)
    if head_id:
        q = q.where(AccountEntry.head_id == head_id)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(AccountEntry.party.ilike(like) | AccountEntry.note.ilike(like) | AccountEntry.voucher_no.ilike(like) |
                    AccountEntry.reference.ilike(like))
    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = (await db.scalars(q.order_by(AccountEntry.date.desc(), AccountEntry.created_at.desc()).offset(page.offset).limit(page.page_size))).all()
    return await _entries_out(db, list(rows)), PageMeta(total=total, page=page.page, page_size=page.page_size)


async def _head(db: AsyncSession, user: User, head_id: uuid.UUID, kind: str) -> LedgerHead:
    h = await db.scalar(select(LedgerHead).where(LedgerHead.id == head_id, LedgerHead.school_id == user.school_id))
    if not h or not h.is_active:
        raise field_error("head_id", "Choose an active head")
    if h.kind != kind:
        raise field_error("head_id", f"Choose an {kind} head")
    return h


async def create_entry(db: AsyncSession, user: User, data: EntryIn) -> EntryOut:
    await _head(db, user, data.head_id, data.kind)
    today = await school_today(db, user.school_id)
    if data.date > today:
        raise field_error("date", "The date can't be in the future")
    prefix = f"{'RV' if data.kind == 'income' else 'PV'}-{academic_year(data.date).replace('-', '')[2:]}-"
    n = await db.scalar(select(func.count()).select_from(AccountEntry).where(AccountEntry.school_id == user.school_id,
                                                                              AccountEntry.voucher_no.like(f"{prefix}%"))) or 0
    e = AccountEntry(school_id=user.school_id, voucher_no=f"{prefix}{n + 1:05d}", created_by=user.id, **data.model_dump())
    db.add(e)
    await db.flush()
    await db.refresh(e)
    await audit_service.record(db, f"accounts.{data.kind}", school_id=user.school_id, user_id=user.id, entity_type="account_entry",
                               entity_id=e.id, meta={"voucher_no": e.voucher_no, "amount": float(e.amount)})
    return (await _entries_out(db, [e]))[0]


async def _entry(db: AsyncSession, user: User, entry_id: uuid.UUID) -> AccountEntry:
    e = await db.scalar(select(AccountEntry).where(AccountEntry.id == entry_id, AccountEntry.school_id == user.school_id))
    if not e:
        raise NotFound("Entry not found")
    return e


async def update_entry(db: AsyncSession, user: User, entry_id: uuid.UUID, data: EntryIn) -> EntryOut:
    e = await _entry(db, user, entry_id)
    if data.kind != e.kind:
        raise field_error("kind", "An entry can't switch between income and expense; delete it and add a new one")
    await _head(db, user, data.head_id, data.kind)
    for k, v in data.model_dump().items():
        setattr(e, k, v)
    await db.flush()
    await audit_service.record(db, "accounts.edit", school_id=user.school_id, user_id=user.id, entity_type="account_entry",
                               entity_id=e.id, meta={"voucher_no": e.voucher_no, "amount": float(e.amount)})
    return (await _entries_out(db, [e]))[0]


async def delete_entry(db: AsyncSession, user: User, entry_id: uuid.UUID) -> None:
    e = await _entry(db, user, entry_id)
    await audit_service.record(db, "accounts.delete", school_id=user.school_id, user_id=user.id, entity_type="account_entry",
                               entity_id=e.id, meta={"voucher_no": e.voucher_no, "amount": float(e.amount)})
    await db.delete(e)


# ---- summary ----------------------------------------------------------------------------------

async def _local_paid_at(db: AsyncSession, school_id: uuid.UUID):
    """FeePayment.paid_at in the school's own time zone, so evening payments fall on the right day."""
    tz = await db.scalar(select(School.timezone).where(School.id == school_id)) or "Asia/Kolkata"
    return func.timezone(tz, FeePayment.paid_at)


async def summary(db: AsyncSession, user: User, start: date, end: date) -> AccountsSummary:
    if end < start:
        raise field_error("to", "The end date is before the start date")
    local = await _local_paid_at(db, user.school_id)
    month = func.to_char(local, literal_column("'YYYY-MM'"))
    fees = (await db.execute(select(FeePayment.method, func.sum(FeePayment.amount), month)
                             .where(FeePayment.school_id == user.school_id, func.date(local) >= start, func.date(local) <= end)
                             .group_by(FeePayment.method, month))).all()
    entries = (await db.execute(select(AccountEntry.kind, LedgerHead.name, AccountEntry.method, AccountEntry.amount, AccountEntry.date)
                                .join(LedgerHead, LedgerHead.id == AccountEntry.head_id)
                                .where(AccountEntry.school_id == user.school_id, AccountEntry.date >= start, AccountEntry.date <= end))).all()
    by_month: dict[str, dict[str, Decimal]] = defaultdict(lambda: {"income": ZERO, "expense": ZERO})
    fee_by_method: dict[str, Decimal] = defaultdict(lambda: ZERO)
    cash = ZERO
    for method, amount, ym in fees:
        fee_by_method[method] += amount
        by_month[ym]["income"] += amount
        if method == "cash":
            cash += amount
    income_heads: dict[str, Decimal] = defaultdict(lambda: ZERO)
    expense_heads: dict[str, Decimal] = defaultdict(lambda: ZERO)
    for kind, head, method, amount, d in entries:
        (income_heads if kind == "income" else expense_heads)[head] += amount
        by_month[d.strftime("%Y-%m")][kind] += amount
        if method == "cash":
            cash += amount if kind == "income" else -amount
    fee_income = sum(fee_by_method.values(), ZERO)
    other = sum(income_heads.values(), ZERO)
    expense = sum(expense_heads.values(), ZERO)
    months, d = [], start.replace(day=1)
    while d <= end:
        months.append(d.strftime("%Y-%m"))
        d = (d + timedelta(days=32)).replace(day=1)
    return AccountsSummary(
        start=start, end=end, fee_income=fee_income, other_income=other, expense=expense, net=fee_income + other - expense,
        income_by_head=[HeadTotal(name=f"Fees · {METHODS.get(m, m)}", amount=v) for m, v in sorted(fee_by_method.items(), key=lambda x: -x[1])]
        + [HeadTotal(name=k, amount=v) for k, v in sorted(income_heads.items(), key=lambda x: -x[1])],
        expense_by_head=[HeadTotal(name=k, amount=v) for k, v in sorted(expense_heads.items(), key=lambda x: -x[1])],
        by_month=[MonthTotal(month=m, income=by_month[m]["income"], expense=by_month[m]["expense"]) for m in months],
        cash_in_hand=cash)


# ---- exports ----------------------------------------------------------------------------------

def _ledger_for(method: str) -> str:
    return "Cash" if method == "cash" else "Bank Account"


async def tally_xml(db: AsyncSession, user: User, start: date, end: date) -> str:
    """Tally Prime / ERP 9 vouchers: fee receipts and other income as Receipts, expenses as Payments."""
    school = await db.get(School, user.school_id)
    local = await _local_paid_at(db, user.school_id)
    pays = (await db.execute(select(FeePayment, FeeInvoice, Student, func.date(local)).join(FeeInvoice, FeeInvoice.id == FeePayment.invoice_id)
                             .join(Student, Student.id == FeeInvoice.student_id)
                             .where(FeePayment.school_id == user.school_id, func.date(local) >= start,
                                    func.date(local) <= end).order_by(FeePayment.paid_at))).all()
    entries = (await db.execute(select(AccountEntry, LedgerHead.name).join(LedgerHead, LedgerHead.id == AccountEntry.head_id)
                                .where(AccountEntry.school_id == user.school_id, AccountEntry.date >= start, AccountEntry.date <= end)
                                .order_by(AccountEntry.date))).all()

    def voucher(vtype: str, number: str, d: date, narration: str, debit: str, credit: str, amount: Decimal) -> str:
        amt = f"{amount:.2f}"
        return (f'<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="{vtype}" ACTION="Create">'
                f"<DATE>{d:%Y%m%d}</DATE><VOUCHERTYPENAME>{vtype}</VOUCHERTYPENAME><VOUCHERNUMBER>{escape(number)}</VOUCHERNUMBER>"
                f"<NARRATION>{escape(narration)}</NARRATION>"
                f"<ALLLEDGERENTRIES.LIST><LEDGERNAME>{escape(debit)}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-{amt}</AMOUNT></ALLLEDGERENTRIES.LIST>"
                f"<ALLLEDGERENTRIES.LIST><LEDGERNAME>{escape(credit)}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>{amt}</AMOUNT></ALLLEDGERENTRIES.LIST>"
                "</VOUCHER></TALLYMESSAGE>")

    msgs = []
    for p, inv, s, day in pays:
        msgs.append(voucher("Receipt", p.receipt_no, day, f"Fees {inv.term} - {s.first_name} {s.last_name} ({s.admission_no})"
                            + (f" ref {p.reference}" if p.reference else ""), _ledger_for(p.method), "Fee Income", p.amount))
    for e, head in entries:
        narration = " - ".join(x for x in (head, e.party, e.note, f"ref {e.reference}" if e.reference else None) if x)
        if e.kind == "income":
            msgs.append(voucher("Receipt", e.voucher_no, e.date, narration, _ledger_for(e.method), head, e.amount))
        else:
            msgs.append(voucher("Payment", e.voucher_no, e.date, narration, head, _ledger_for(e.method), e.amount))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>'
            f"<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>{escape(school.name)}"
            "</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>" + "".join(msgs) + "</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>\n")


async def daybook_csv(db: AsyncSession, user: User, start: date, end: date) -> str:
    import csv
    import io
    local = await _local_paid_at(db, user.school_id)
    pays = (await db.execute(select(FeePayment, FeeInvoice, Student, func.date(local)).join(FeeInvoice, FeeInvoice.id == FeePayment.invoice_id)
                             .join(Student, Student.id == FeeInvoice.student_id)
                             .where(FeePayment.school_id == user.school_id, func.date(local) >= start, func.date(local) <= end))).all()
    entries = (await db.execute(select(AccountEntry, LedgerHead.name).join(LedgerHead, LedgerHead.id == AccountEntry.head_id)
                                .where(AccountEntry.school_id == user.school_id, AccountEntry.date >= start, AccountEntry.date <= end))).all()
    rows = [(day, p.receipt_no, "Income", "Fees", f"{s.first_name} {s.last_name} ({s.admission_no})", METHODS.get(p.method, p.method),
             p.reference or "", f"{inv.term}", p.amount, ZERO) for p, inv, s, day in pays]
    rows += [(e.date, e.voucher_no, e.kind.title(), head, e.party or "", METHODS.get(e.method, e.method), e.reference or "", e.note or "",
              e.amount if e.kind == "income" else ZERO, e.amount if e.kind == "expense" else ZERO) for e, head in entries]
    rows.sort(key=lambda r: (r[0], r[1]))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "voucher", "type", "head", "party", "method", "reference", "note", "received", "paid"])
    for r in rows:
        w.writerow([r[0].isoformat(), *r[1:8], f"{r[8]:.2f}", f"{r[9]:.2f}"])
    return "﻿" + buf.getvalue()


# Receipts and bills attached to vouchers.
async def _can_attach(db: AsyncSession, user: User, owner_id: uuid.UUID | None) -> bool:
    from app.core.permissions import has_permission
    return bool(owner_id) and has_permission(user.role, "accounts.manage") and bool(
        await db.scalar(select(AccountEntry.id).where(AccountEntry.id == owner_id, AccountEntry.school_id == user.school_id)))


async def _can_read(db: AsyncSession, user: User, owner_id: uuid.UUID | None) -> bool:
    from app.core.permissions import has_permission
    return has_permission(user.role, "accounts.view")


storage_service.register_purpose("voucher", storage_service.Purpose(can_upload=_can_attach, can_read=_can_read))
