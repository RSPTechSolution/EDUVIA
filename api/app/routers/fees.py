"""Fees: setup, invoices, collection, dashboard, and the parent/student view with online payment."""
import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import DB, CurrentUser, require_module, require_permission
from app.core.permissions import has_permission
from app.schemas.common import ApiResponse, PageParams, ok
from app.schemas.finance import (
    CategoryIn, CategoryOut, CategoryUpdate, CollectPayment, DiscountSet, FeeSummary, GenerateInvoices,
    GenerateResult, InvoiceDetail, InvoiceRow, MyFees, PaymentOut, Receipt, StructureMatrix, StructureSet,
)
from app.services import fee_service as svc, pdf_service

router = APIRouter(dependencies=[require_module("fees")])


@router.get("/summary", response_model=ApiResponse[FeeSummary])
async def summary(db: DB, current: CurrentUser = require_permission("fees.view")):
    return ok(await svc.summary(db, current.require_school()))


# ---- setup ------------------------------------------------------------------------------------

@router.get("/categories", response_model=ApiResponse[list[CategoryOut]])
async def categories(db: DB, current: CurrentUser = require_permission("fees.view")):
    return ok([CategoryOut.model_validate(c) for c in await svc.list_categories(db, current.require_school())])


@router.post("/categories", response_model=ApiResponse[CategoryOut], status_code=201)
async def create_category(body: CategoryIn, db: DB, current: CurrentUser = require_permission("fees.manage")):
    return ok(CategoryOut.model_validate(await svc.create_category(db, current.require_school(), body, actor_id=current.id)))


@router.patch("/categories/{category_id}", response_model=ApiResponse[CategoryOut])
async def update_category(category_id: uuid.UUID, body: CategoryUpdate, db: DB, current: CurrentUser = require_permission("fees.manage")):
    return ok(CategoryOut.model_validate(await svc.update_category(db, current.require_school(), category_id, body, actor_id=current.id)))


@router.get("/structures", response_model=ApiResponse[StructureMatrix])
async def structures(db: DB, current: CurrentUser = require_permission("fees.view")):
    return ok(await svc.structure_matrix(db, current.require_school()))


@router.put("/structures", response_model=ApiResponse[StructureMatrix])
async def set_structure(body: StructureSet, db: DB, current: CurrentUser = require_permission("fees.manage")):
    await svc.set_structure(db, current.require_school(), body, actor_id=current.id)
    return ok(await svc.structure_matrix(db, current.require_school()))


@router.post("/invoices/generate", response_model=ApiResponse[GenerateResult])
async def generate(body: GenerateInvoices, db: DB, current: CurrentUser = require_permission("fees.manage")):
    return ok(await svc.generate_invoices(db, current.require_school(), body, actor_id=current.id))


# ---- invoices & collection --------------------------------------------------------------------

@router.get("/invoices", response_model=ApiResponse[list[InvoiceRow]])
async def invoices(
    db: DB, page: PageParams = Depends(), status: str | None = Query(None, pattern="^(unpaid|partial|paid|cancelled|overdue|due)$"),
    class_id: uuid.UUID | None = None, term: str | None = None, search: str | None = None, student_id: uuid.UUID | None = None,
    current: CurrentUser = require_permission("fees.view"),
):
    rows, meta = await svc.list_invoices(db, current.require_school(), page, status=status, class_id=class_id, term=term,
                                         search=search, student_id=student_id)
    return ok(rows, meta)


@router.get("/terms", response_model=ApiResponse[list[str]])
async def terms(db: DB, current: CurrentUser = require_permission("fees.view")):
    return ok(await svc.terms(db, current.require_school()))


@router.get("/invoices/{invoice_id}", response_model=ApiResponse[InvoiceDetail])
async def invoice(invoice_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("fees.view")):
    return ok(await svc.invoice_detail(db, current.require_school(), invoice_id))


@router.post("/invoices/{invoice_id}/payments", response_model=ApiResponse[PaymentOut], status_code=201)
async def collect(invoice_id: uuid.UUID, body: CollectPayment, db: DB, current: CurrentUser = require_permission("fees.collect")):
    return ok(await svc.collect(db, current.require_school(), invoice_id, body, actor_id=current.id))


@router.put("/invoices/{invoice_id}/discount", response_model=ApiResponse[InvoiceDetail])
async def discount(invoice_id: uuid.UUID, body: DiscountSet, db: DB, current: CurrentUser = require_permission("fees.manage")):
    await svc.set_discount(db, current.require_school(), invoice_id, body, actor_id=current.id)
    return ok(await svc.invoice_detail(db, current.require_school(), invoice_id))


@router.get("/payments/{payment_id}/receipt", response_model=ApiResponse[Receipt])
async def receipt(payment_id: uuid.UUID, db: DB, current: CurrentUser = require_permission("school.view")):
    """Staff with fees.view, or the parent/student the receipt belongs to."""
    current.require_school()
    return ok(await svc.receipt(db, current.user, payment_id, has_permission(current.role, "fees.view")))


# ---- parents & students -----------------------------------------------------------------------

@router.get("/my", response_model=ApiResponse[MyFees])
async def mine(db: DB, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    return ok(await svc.my_fees(db, current.user))


@router.get("/payments/{payment_id}/receipt.pdf")
async def receipt_pdf(payment_id: uuid.UUID, db: DB, download: bool = False, current: CurrentUser = require_permission("school.view")):
    current.require_school()
    r = await svc.receipt(db, current.user, payment_id, has_permission(current.role, "fees.view"))
    return pdf_service.pdf_response(pdf_service.fee_receipt(r), f"receipt-{r.payment.receipt_no}.pdf", download)
