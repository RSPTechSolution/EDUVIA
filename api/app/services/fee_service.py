"""Fee categories, class fee structures, invoices, counter collection, concessions and online payment."""
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models import (
    FeeCategory, FeeInvoice, FeeInvoiceItem, FeePayment, FeeStructure, School, SchoolClass, Section,
    Student, StudentGuardian, User,
)
from app.schemas.common import PageMeta, PageParams
from app.schemas.finance import (
    CategoryIn, CategoryOut, CategoryUpdate, ChildFees, ClassDue, CollectPayment, DayAmount, DiscountSet, FeeSummary,
    GenerateInvoices, GenerateResult, InvoiceDetail, InvoiceItemOut, InvoiceRow, MethodAmount, MyFees,
    PaymentOut, Receipt, StructureClass, StructureMatrix, StructureSet,
)
from app.services import audit_service
from app.services import notify
from app.services.academics_service import field_error
from app.services.attendance_service import academic_year_start
from app.services.family_service import own_students, school_today

ZERO = Decimal("0")


def academic_year(d: date) -> str:
    y = academic_year_start(d).year
    return f"{y}-{(y + 1) % 100:02d}"


def balance(inv: FeeInvoice) -> Decimal:
    return max(inv.total - inv.discount - inv.paid, ZERO)


def _status(inv: FeeInvoice) -> str:
    if inv.status == "cancelled":
        return "cancelled"
    if balance(inv) <= 0:
        return "paid"
    return "partial" if inv.paid > 0 else "unpaid"


async def _next_number(db: AsyncSession, school_id: uuid.UUID, model, column, prefix: str) -> str:
    n = await db.scalar(select(func.count()).select_from(model).where(model.school_id == school_id, column.like(f"{prefix}%")))
    return f"{prefix}{(n or 0) + 1:05d}"


# ---- categories -------------------------------------------------------------------------------

async def list_categories(db: AsyncSession, school_id: uuid.UUID) -> list[FeeCategory]:
    return list((await db.scalars(select(FeeCategory).where(FeeCategory.school_id == school_id)
                                  .order_by(FeeCategory.sort_order, FeeCategory.name))).all())


async def create_category(db: AsyncSession, school_id: uuid.UUID, data: CategoryIn, *, actor_id: uuid.UUID) -> FeeCategory:
    if await db.scalar(select(FeeCategory.id).where(FeeCategory.school_id == school_id, func.lower(FeeCategory.name) == data.name.lower())):
        raise field_error("name", f"{data.name} already exists")
    order = (await db.scalar(select(func.max(FeeCategory.sort_order)).where(FeeCategory.school_id == school_id)) or 0) + 1
    c = FeeCategory(school_id=school_id, name=data.name, description=data.description or None, is_active=data.is_active, sort_order=order)
    db.add(c)
    await db.flush()
    await audit_service.record(db, "fees.category.create", school_id=school_id, user_id=actor_id, entity_type="fee_category",
                               entity_id=c.id, meta={"name": c.name})
    return c


async def update_category(db: AsyncSession, school_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate, *, actor_id: uuid.UUID) -> FeeCategory:
    c = await db.scalar(select(FeeCategory).where(FeeCategory.id == category_id, FeeCategory.school_id == school_id))
    if not c:
        raise NotFound("Fee category not found")
    values = data.model_dump(exclude_unset=True)
    if values.get("name") and await db.scalar(select(FeeCategory.id).where(
            FeeCategory.school_id == school_id, func.lower(FeeCategory.name) == values["name"].lower(), FeeCategory.id != c.id)):
        raise field_error("name", f"{values['name']} already exists")
    for k, v in values.items():
        if v is not None or k == "description":
            setattr(c, k, v)
    await audit_service.record(db, "fees.category.update", school_id=school_id, user_id=actor_id, entity_type="fee_category", entity_id=c.id)
    return c


# ---- structures -------------------------------------------------------------------------------

async def structure_matrix(db: AsyncSession, school_id: uuid.UUID) -> StructureMatrix:
    cats = await list_categories(db, school_id)
    classes = (await db.scalars(select(SchoolClass).where(SchoolClass.school_id == school_id).order_by(SchoolClass.sort_order))).all()
    amounts: dict[uuid.UUID, dict[str, Decimal]] = defaultdict(dict)
    for s in (await db.scalars(select(FeeStructure).where(FeeStructure.school_id == school_id))).all():
        amounts[s.class_id][str(s.category_id)] = s.amount
    counts = dict((await db.execute(select(Student.class_id, func.count()).where(
        Student.school_id == school_id, Student.status == "active").group_by(Student.class_id))).all())
    active = {str(c.id) for c in cats if c.is_active}
    return StructureMatrix(
        categories=[CategoryOut.model_validate(c) for c in cats],
        classes=[StructureClass(class_id=c.id, class_name=c.name, students=counts.get(c.id, 0), amounts=amounts[c.id],
                                total=sum((v for k, v in amounts[c.id].items() if k in active), ZERO)) for c in classes])


async def set_structure(db: AsyncSession, school_id: uuid.UUID, data: StructureSet, *, actor_id: uuid.UUID) -> None:
    if not await db.scalar(select(SchoolClass.id).where(SchoolClass.id == data.class_id, SchoolClass.school_id == school_id)):
        raise field_error("class_id", "Choose a class from your school")
    cats = {c.id for c in await list_categories(db, school_id)}
    existing = {s.category_id: s for s in (await db.scalars(select(FeeStructure).where(FeeStructure.class_id == data.class_id))).all()}
    for i, item in enumerate(data.items):
        if item.category_id not in cats:
            raise field_error(f"items.{i}.category_id", "Choose a fee category from your school")
        row = existing.pop(item.category_id, None)
        if item.amount == 0:
            if row:
                await db.delete(row)
        elif row:
            row.amount = item.amount
        else:
            db.add(FeeStructure(school_id=school_id, class_id=data.class_id, category_id=item.category_id, amount=item.amount))
    await audit_service.record(db, "fees.structure.update", school_id=school_id, user_id=actor_id, entity_type="class",
                               entity_id=data.class_id, meta={"items": len(data.items)})


# ---- invoices ---------------------------------------------------------------------------------

async def generate_invoices(db: AsyncSession, school_id: uuid.UUID, data: GenerateInvoices, *, actor_id: uuid.UUID) -> GenerateResult:
    today = await school_today(db, school_id)
    cats = {c.id: c for c in await list_categories(db, school_id) if c.is_active and (not data.category_ids or c.id in data.category_ids)}
    if not cats:
        raise field_error("category_ids", "Choose at least one active fee category")
    stmt = select(Student).where(Student.school_id == school_id, Student.status == "active")
    if data.class_ids:
        stmt = stmt.where(Student.class_id.in_(data.class_ids))
    students = (await db.scalars(stmt)).all()
    structures: dict[uuid.UUID, list[FeeStructure]] = defaultdict(list)
    for s in (await db.scalars(select(FeeStructure).where(FeeStructure.school_id == school_id, FeeStructure.category_id.in_(cats)))).all():
        structures[s.class_id].append(s)
    already = set((await db.scalars(select(FeeInvoice.student_id).where(FeeInvoice.school_id == school_id, FeeInvoice.term == data.term))).all())
    year = academic_year(data.due_date)
    prefix = f"INV-{year.replace('-', '')[2:]}-"
    seq = int((await _next_number(db, school_id, FeeInvoice, FeeInvoice.invoice_no, prefix))[-5:])
    created = skipped_existing = skipped_zero = 0
    billed = ZERO
    for st in sorted(students, key=lambda s: s.admission_no):
        if st.id in already:
            skipped_existing += 1
            continue
        items = [(cats[s.category_id], s.amount) for s in structures[st.class_id]]
        total = sum((a for _, a in items), ZERO)
        if total <= 0:
            skipped_zero += 1
            continue
        inv = FeeInvoice(school_id=school_id, invoice_no=f"{prefix}{seq:05d}", student_id=st.id, term=data.term, academic_year=year,
                         issue_date=today, due_date=data.due_date, total=total, discount=ZERO, paid=ZERO, status="unpaid")
        seq += 1
        db.add(inv)
        await db.flush()
        db.add_all([FeeInvoiceItem(school_id=school_id, invoice_id=inv.id, category_id=c.id, name=c.name, amount=a)
                    for c, a in sorted(items, key=lambda x: x[0].sort_order)])
        created += 1
        billed += total
    await audit_service.record(db, "fees.invoices.generate", school_id=school_id, user_id=actor_id, entity_type="fee_invoice",
                               meta={"term": data.term, "created": created, "total": float(billed)})
    return GenerateResult(created=created, skipped_existing=skipped_existing, skipped_zero=skipped_zero, total_billed=billed)


def _row_query(school_id: uuid.UUID):
    return (select(FeeInvoice, Student, SchoolClass.name, Section.name)
            .join(Student, Student.id == FeeInvoice.student_id)
            .join(Section, Section.id == Student.section_id).join(SchoolClass, SchoolClass.id == Student.class_id)
            .where(FeeInvoice.school_id == school_id))


def _row(inv: FeeInvoice, st: Student, cname: str, sname: str, today: date) -> dict:
    bal = balance(inv)
    return dict(id=inv.id, invoice_no=inv.invoice_no, student_id=st.id, student_name=f"{st.first_name} {st.last_name}",
                admission_no=st.admission_no, class_section=f"{cname} – {sname}", term=inv.term, due_date=inv.due_date,
                total=inv.total, discount=inv.discount, paid=inv.paid, balance=bal, status=inv.status,
                overdue=bal > 0 and inv.status != "cancelled" and inv.due_date < today)


async def list_invoices(db: AsyncSession, school_id: uuid.UUID, page: PageParams, *, status: str | None, class_id: uuid.UUID | None,
                        term: str | None, search: str | None, student_id: uuid.UUID | None = None) -> tuple[list[InvoiceRow], PageMeta]:
    today = await school_today(db, school_id)
    stmt = _row_query(school_id)
    if status == "overdue":
        stmt = stmt.where(FeeInvoice.status.in_(["unpaid", "partial"]), FeeInvoice.due_date < today)
    elif status == "due":
        stmt = stmt.where(FeeInvoice.status.in_(["unpaid", "partial"]))
    elif status:
        stmt = stmt.where(FeeInvoice.status == status)
    if class_id:
        stmt = stmt.where(Student.class_id == class_id)
    if term:
        stmt = stmt.where(FeeInvoice.term == term)
    if student_id:
        stmt = stmt.where(FeeInvoice.student_id == student_id)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(or_(func.lower(Student.first_name + " " + Student.last_name).like(like),
                              func.lower(Student.admission_no).like(like), func.lower(FeeInvoice.invoice_no).like(like)))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await db.execute(stmt.order_by(FeeInvoice.due_date.desc(), SchoolClass.sort_order, Section.name, Student.roll_no)
                             .offset(page.offset).limit(page.page_size))).all()
    return [InvoiceRow(**_row(*r, today)) for r in rows], PageMeta(total=total, page=page.page, page_size=page.page_size)


async def terms(db: AsyncSession, school_id: uuid.UUID) -> list[str]:
    rows = (await db.execute(select(FeeInvoice.term, func.min(FeeInvoice.due_date)).where(FeeInvoice.school_id == school_id)
                             .group_by(FeeInvoice.term).order_by(func.min(FeeInvoice.due_date).desc()))).all()
    return [t for t, _ in rows]


async def _payments_out(db: AsyncSession, payments: list[FeePayment]) -> list[PaymentOut]:
    ids = {p.collected_by for p in payments if p.collected_by} | {p.paid_by for p in payments if p.paid_by}
    names = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))).all()) if ids else {}
    return [PaymentOut(id=p.id, receipt_no=p.receipt_no, amount=p.amount, method=p.method, reference=p.reference, note=p.note,
                       paid_at=p.paid_at, collected_by=f"Paid online by {names.get(p.paid_by, 'parent')}" if p.paid_by
                       else names.get(p.collected_by)) for p in payments]


async def _get_invoice(db: AsyncSession, school_id: uuid.UUID, invoice_id: uuid.UUID) -> FeeInvoice:
    inv = await db.scalar(select(FeeInvoice).where(FeeInvoice.id == invoice_id, FeeInvoice.school_id == school_id))
    if not inv:
        raise NotFound("Invoice not found")
    return inv


async def invoice_detail(db: AsyncSession, school_id: uuid.UUID, invoice_id: uuid.UUID) -> InvoiceDetail:
    today = await school_today(db, school_id)
    row = (await db.execute(_row_query(school_id).where(FeeInvoice.id == invoice_id))).first()
    if not row:
        raise NotFound("Invoice not found")
    inv, st = row[0], row[1]
    items = (await db.scalars(select(FeeInvoiceItem).where(FeeInvoiceItem.invoice_id == inv.id))).all()
    payments = (await db.scalars(select(FeePayment).where(FeePayment.invoice_id == inv.id).order_by(FeePayment.paid_at))).all()
    phone = await db.scalar(select(User.phone).join(StudentGuardian, StudentGuardian.user_id == User.id)
                            .where(StudentGuardian.student_id == st.id).order_by(StudentGuardian.is_primary.desc()).limit(1))
    return InvoiceDetail(**_row(*row, today), academic_year=inv.academic_year, issue_date=inv.issue_date,
                         discount_reason=inv.discount_reason, items=[InvoiceItemOut(name=i.name, amount=i.amount) for i in items],
                         payments=await _payments_out(db, list(payments)), guardian_phone=phone)


async def _record_payment(db: AsyncSession, inv: FeeInvoice, amount: Decimal, method: str, *, reference: str | None,
                          note: str | None, collected_by: uuid.UUID | None, paid_by: uuid.UUID | None) -> FeePayment:
    prefix = f"RCT-{inv.academic_year.replace('-', '')[2:]}-"
    p = FeePayment(school_id=inv.school_id, receipt_no=await _next_number(db, inv.school_id, FeePayment, FeePayment.receipt_no, prefix),
                   invoice_id=inv.id, amount=amount, method=method, reference=reference, note=note,
                   collected_by=collected_by, paid_by=paid_by, paid_at=datetime.now(UTC))
    db.add(p)
    inv.paid += amount
    inv.status = _status(inv)
    await db.flush()
    await audit_service.record(db, "fees.payment", school_id=inv.school_id, user_id=collected_by or paid_by, entity_type="fee_invoice",
                               entity_id=inv.id, meta={"amount": float(amount), "method": method, "receipt_no": p.receipt_no,
                                                       "invoice_no": inv.invoice_no})
    await notify.fee_paid(db, p, inv)
    return p


async def collect(db: AsyncSession, school_id: uuid.UUID, invoice_id: uuid.UUID, data: CollectPayment, *, actor_id: uuid.UUID) -> PaymentOut:
    inv = await _get_invoice(db, school_id, invoice_id)
    if inv.status == "cancelled":
        raise Conflict("This invoice was cancelled", code="INVOICE_CANCELLED")
    due = balance(inv)
    if due <= 0:
        raise Conflict("This invoice is already paid", code="ALREADY_PAID")
    if data.amount > due:
        raise field_error("amount", f"Only ₹{due:,.2f} is due on this invoice")
    p = await _record_payment(db, inv, data.amount, data.method, reference=data.reference or None, note=data.note or None,
                              collected_by=actor_id, paid_by=None)
    return (await _payments_out(db, [p]))[0]


async def set_discount(db: AsyncSession, school_id: uuid.UUID, invoice_id: uuid.UUID, data: DiscountSet, *, actor_id: uuid.UUID) -> None:
    inv = await _get_invoice(db, school_id, invoice_id)
    if data.amount > inv.total - inv.paid:
        raise field_error("amount", f"The concession can be at most ₹{inv.total - inv.paid:,.2f} (total less what's been paid)")
    old = inv.discount
    inv.discount, inv.discount_reason = data.amount, data.reason
    inv.status = _status(inv)
    await audit_service.record(db, "fees.discount", school_id=school_id, user_id=actor_id, entity_type="fee_invoice", entity_id=inv.id,
                               meta={"from": float(old), "to": float(data.amount), "reason": data.reason, "invoice_no": inv.invoice_no})


async def receipt(db: AsyncSession, user: User, payment_id: uuid.UUID, staff_ok: bool) -> Receipt:
    p = await db.scalar(select(FeePayment).where(FeePayment.id == payment_id, FeePayment.school_id == user.school_id))
    if not p:
        raise NotFound("Receipt not found")
    inv = await _get_invoice(db, user.school_id, p.invoice_id)
    if not staff_ok and inv.student_id not in {s.id for s in await own_students(db, user)}:
        raise NotFound("Receipt not found")
    school = await db.get(School, user.school_id)
    paid_up_to = await db.scalar(select(func.coalesce(func.sum(FeePayment.amount), 0)).where(
        FeePayment.invoice_id == inv.id, FeePayment.paid_at <= p.paid_at))
    return Receipt(payment=(await _payments_out(db, [p]))[0], invoice=await invoice_detail(db, user.school_id, inv.id),
                   school_name=school.name, school_address=school.address, school_phone=school.phone,
                   balance_after=max(inv.total - inv.discount - Decimal(paid_up_to), ZERO))


# ---- dashboard --------------------------------------------------------------------------------

async def summary(db: AsyncSession, school_id: uuid.UUID) -> FeeSummary:
    tz = ZoneInfo(await db.scalar(select(School.timezone).where(School.id == school_id)) or "Asia/Kolkata")
    now = datetime.now(tz)
    today = now.date()
    start_of = lambda d: datetime(d.year, d.month, d.day, tzinfo=tz)  # noqa: E731
    year_start = academic_year_start(today)

    async def collected(since: date) -> Decimal:
        return await db.scalar(select(func.coalesce(func.sum(FeePayment.amount), 0)).where(
            FeePayment.school_id == school_id, FeePayment.paid_at >= start_of(since))) or ZERO

    due_rows = (await db.execute(select(FeeInvoice, SchoolClass.name, Student.id).join(Student, Student.id == FeeInvoice.student_id)
                                 .join(SchoolClass, SchoolClass.id == Student.class_id)
                                 .where(FeeInvoice.school_id == school_id, FeeInvoice.status != "cancelled"))).all()
    outstanding = overdue = fallen_due = paid_on_fallen = billed_year = ZERO
    overdue_n = 0
    by_class: dict[str, list] = defaultdict(lambda: [ZERO, set()])
    for inv, cname, sid in due_rows:
        bal = balance(inv)
        if inv.academic_year == academic_year(today):
            billed_year += inv.total - inv.discount
        outstanding += bal
        if inv.due_date <= today:
            fallen_due += inv.total - inv.discount
            paid_on_fallen += min(inv.paid, inv.total - inv.discount)
        if bal > 0 and inv.due_date < today:
            overdue += bal
            overdue_n += 1
        if bal > 0:
            by_class[cname][0] += bal
            by_class[cname][1].add(sid)
    since = today - timedelta(days=29)
    daily: dict[date, Decimal] = defaultdict(lambda: ZERO)
    for at, amount in (await db.execute(select(FeePayment.paid_at, FeePayment.amount).where(
            FeePayment.school_id == school_id, FeePayment.paid_at >= start_of(since)))).all():
        daily[at.astimezone(tz).date()] += amount
    month_start = today.replace(day=1)
    methods = (await db.execute(select(FeePayment.method, func.sum(FeePayment.amount), func.count()).where(
        FeePayment.school_id == school_id, FeePayment.paid_at >= start_of(year_start)).group_by(FeePayment.method)
        .order_by(func.sum(FeePayment.amount).desc()))).all()
    recent = (await db.scalars(select(FeePayment).where(FeePayment.school_id == school_id).order_by(FeePayment.paid_at.desc()).limit(8))).all()
    return FeeSummary(
        collected_today=await collected(today), collected_month=await collected(month_start), collected_year=await collected(year_start),
        billed_year=billed_year, outstanding=outstanding, overdue=overdue, overdue_invoices=overdue_n,
        collection_rate=round(float(100 * paid_on_fallen / fallen_due), 1) if fallen_due else None,
        daily=[DayAmount(date=since + timedelta(days=i), amount=daily[since + timedelta(days=i)]) for i in range(30)],
        by_method=[MethodAmount(method=m, amount=a, count=n) for m, a, n in methods],
        by_class=sorted([ClassDue(class_name=c, outstanding=v[0], students=len(v[1])) for c, v in by_class.items()],
                        key=lambda x: -x.outstanding)[:10],
        recent=await _payments_out(db, list(recent)))


# ---- parents, students and online payment ----------------------------------------------------

async def my_fees(db: AsyncSession, user: User) -> MyFees:
    today = await school_today(db, user.school_id)
    children = []
    for st in await own_students(db, user):
        ids = (await db.scalars(select(FeeInvoice.id).where(FeeInvoice.student_id == st.id, FeeInvoice.status != "cancelled")
                                .order_by(FeeInvoice.due_date.desc()))).all()
        invoices = [await invoice_detail(db, user.school_id, i) for i in ids]
        open_ = [i for i in invoices if i.balance > 0]
        children.append(ChildFees(
            student_id=st.id, name=f"{st.first_name} {st.last_name}",
            class_section=invoices[0].class_section if invoices else "",
            due=sum((i.balance for i in open_), ZERO), overdue=sum((i.balance for i in open_ if i.overdue), ZERO),
            next_due_date=min((i.due_date for i in open_), default=None), invoices=invoices))
    # School fees are paid at the school (cash, UPI, cheque or bank transfer) and recorded by the office; they are
    # never paid online through Vidyanexa. Only a school's own subscription is paid online.
    return MyFees(children=children, total_due=sum((c.due for c in children), ZERO))
