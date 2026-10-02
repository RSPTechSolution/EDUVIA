---
name: schoolerp-phase-04-finance
description: >
  Phase 4 of SchoolERP (Python + Flutter) — fee structure, invoice generation,
  Razorpay/Stripe payment adapters, UPI QR, WeasyPrint PDF receipts, concessions,
  expense ledger, Tally XML export, financial dashboard. Use when building fees,
  payments, invoices, accounts, or financial reports.
---
# Phase 4 — Finance & Fee Collection
## Python FastAPI · Celery · Flutter

## SQLAlchemy Models

```python
# api/app/models/finance.py
class FeeCategory(Base):
    __tablename__ = "fee_categories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)

class FeeStructure(Base):
    __tablename__ = "fee_structures"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"))
    fee_category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_categories.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    frequency: Mapped[str] = mapped_column(String(20), default="annual")
    installments: Mapped[list | None] = mapped_column(JSONB, nullable=True)

class FeeInvoice(Base):
    __tablename__ = "fee_invoices"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id"))
    invoice_no: Mapped[str] = mapped_column(String(50), unique=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="unpaid")  # unpaid|partial|paid
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class FeePayment(Base):
    __tablename__ = "fee_payments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_invoices.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(20))  # cash|cheque|upi|razorpay|stripe
    transaction_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    receipt_no: Mapped[str] = mapped_column(String(50), unique=True)
    collected_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    vendor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    expense_date: Mapped[date] = mapped_column(Date)
    receipt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

## Payment Gateway Adapter Pattern (Python)

```python
# api/app/services/gateways/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class OrderResult:
    order_id: str
    gateway_data: dict

@dataclass
class PaymentVerification:
    transaction_id: str
    status: str
    amount: int

class PaymentGateway(ABC):
    @abstractmethod
    async def create_order(self, amount_paise: int, invoice_id: str, currency: str = "INR") -> OrderResult:
        pass

    @abstractmethod
    async def verify_payment(self, payment_id: str, order_id: str, signature: str) -> PaymentVerification:
        pass

    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        pass

# api/app/services/gateways/razorpay_gateway.py
import razorpay
import hmac, hashlib

class RazorpayGateway(PaymentGateway):
    def __init__(self, key_id: str, key_secret: str):
        self.client = razorpay.Client(auth=(key_id, key_secret))
        self.key_secret = key_secret

    async def create_order(self, amount_paise: int, invoice_id: str, currency: str = "INR") -> OrderResult:
        order = self.client.order.create({
            "amount": amount_paise,
            "currency": currency,
            "receipt": invoice_id,
            "payment_capture": 1,
        })
        return OrderResult(order_id=order["id"], gateway_data={"key_id": self.client.auth[0], "order": order})

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        expected = hmac.new(self.key_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

# api/app/services/gateways/stripe_gateway.py
import stripe

class StripeGateway(PaymentGateway):
    def __init__(self, secret_key: str, webhook_secret: str):
        stripe.api_key = secret_key
        self.webhook_secret = webhook_secret

    async def create_order(self, amount_paise: int, invoice_id: str, currency: str = "inr") -> OrderResult:
        intent = stripe.PaymentIntent.create(
            amount=amount_paise, currency=currency.lower(),
            metadata={"invoice_id": invoice_id},
        )
        return OrderResult(order_id=intent.id, gateway_data={"client_secret": intent.client_secret})

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        try:
            stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
            return True
        except Exception:
            return False

# Factory
def get_gateway(method: str, school_settings: dict) -> PaymentGateway:
    if method == "razorpay":
        return RazorpayGateway(school_settings["razorpay_key_id"], school_settings["razorpay_key_secret"])
    if method == "stripe":
        return StripeGateway(school_settings["stripe_secret_key"], school_settings["stripe_webhook_secret"])
    raise ValueError(f"Unknown gateway: {method}")
```

## PDF Receipt (WeasyPrint)

```python
# api/app/services/fee_service.py
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

jinja = Environment(loader=FileSystemLoader("app/templates/fees"))

async def generate_receipt_pdf(payment: FeePayment, invoice: FeeInvoice, student: Student, school: School) -> bytes:
    html = jinja.get_template("receipt.html").render(
        payment=payment, invoice=invoice, student=student, school=school,
        generated_at=datetime.now().strftime("%d %B %Y %H:%M")
    )
    return HTML(string=html).write_pdf()

async def collect_fee(db: AsyncSession, invoice_id: uuid.UUID, amount: Decimal, method: str, collected_by: uuid.UUID) -> FeePayment:
    invoice = await db.get(FeeInvoice, invoice_id)
    if not invoice:
        raise NotFoundException("Invoice not found")

    receipt_no = f"RCP-{invoice.school_id.hex[:6].upper()}-{int(datetime.utcnow().timestamp())}"
    payment = FeePayment(
        school_id=invoice.school_id, invoice_id=invoice_id,
        amount=amount, method=method, receipt_no=receipt_no,
        collected_by=collected_by,
    )
    db.add(payment)

    # Update invoice status
    invoice.paid_amount += amount
    if invoice.paid_amount >= invoice.total_amount - invoice.discount:
        invoice.status = "paid"
    elif invoice.paid_amount > 0:
        invoice.status = "partial"

    await db.flush()

    # Generate and store PDF
    student = await db.get(Student, invoice.student_id)
    school = await db.get(School, invoice.school_id)
    pdf_bytes = await generate_receipt_pdf(payment, invoice, student, school)
    pdf_url = await upload_to_minio(pdf_bytes, f"receipts/{receipt_no}.pdf", invoice.school_id)
    payment.receipt_url = pdf_url
    await db.commit()
    return payment
```

## Tally ERP XML Export

```python
# api/app/services/tally_service.py
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

async def export_tally_xml(db: AsyncSession, school_id: uuid.UUID, from_date: date, to_date: date) -> bytes:
    payments = await get_payments_in_range(db, school_id, from_date, to_date)

    envelope = Element("ENVELOPE")
    header = SubElement(envelope, "HEADER")
    SubElement(header, "TALLYREQUEST").text = "Import Data"

    body = SubElement(envelope, "BODY")
    import_data = SubElement(body, "IMPORTDATA")
    request_desc = SubElement(import_data, "REQUESTDESC")
    SubElement(request_desc, "REPORTNAME").text = "Vouchers"

    request_data = SubElement(import_data, "REQUESTDATA")
    for p in payments:
        voucher = SubElement(request_data, "TALLYMESSAGE", xmlns_udf="TallyUDF")
        v = SubElement(voucher, "VOUCHER", VCHTYPE="Receipt", ACTION="Create")
        SubElement(v, "DATE").text = p.paid_at.strftime("%Y%m%d")
        SubElement(v, "NARRATION").text = f"Fee receipt {p.receipt_no}"
        SubElement(v, "VOUCHERTYPENAME").text = "Receipt"
        SubElement(v, "VOUCHERNUMBER").text = p.receipt_no
        # Ledger entries
        all_ledgers = SubElement(v, "ALLLEDGERENTRIES.LIST")
        ledger = SubElement(all_ledgers, "ALLLEDGERENTRIES")
        SubElement(ledger, "LEDGERNAME").text = "School Fee Income"
        SubElement(ledger, "AMOUNT").text = str(-p.amount)

    xml_str = minidom.parseString(tostring(envelope)).toprettyxml(indent="  ")
    return xml_str.encode("utf-8")
```

## Flutter — Fee Screen

```dart
// lib/features/fees/screens/fee_invoices_screen.dart
// List of invoices with status chips (unpaid=red, partial=orange, paid=green)
// Tap invoice → InvoiceDetailSheet
// Pay Now button → initiates Razorpay/Stripe

// lib/features/fees/screens/fee_payment_screen.dart
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FeePaymentScreen extends ConsumerStatefulWidget {
  final FeeInvoice invoice;
  const FeePaymentScreen({super.key, required this.invoice});
  @override
  ConsumerState<FeePaymentScreen> createState() => _FeePaymentScreenState();
}

class _FeePaymentScreenState extends ConsumerState<FeePaymentScreen> {
  late Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
  }

  Future<void> _openCheckout() async {
    final api = ref.read(apiClientProvider);
    // Create order on backend
    final res = await api.post('/api/v1/fees/invoices/${widget.invoice.id}/pay-online',
        data: {'gateway': 'razorpay'});
    final data = res['data'];

    _razorpay.open({
      'key': data['key_id'],
      'order_id': data['order_id'],
      'amount': data['amount'],
      'name': data['school_name'],
      'description': 'Fee Payment - ${widget.invoice.invoiceNo}',
      'prefill': {'contact': widget.invoice.studentPhone, 'email': widget.invoice.studentEmail},
    });
  }

  void _onPaymentSuccess(PaymentSuccessResponse response) async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/v1/fees/invoices/${widget.invoice.id}/verify', data: {
      'razorpay_payment_id': response.paymentId,
      'razorpay_order_id': response.orderId,
      'razorpay_signature': response.signature,
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment successful!')));
      context.pop();
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment failed: ${response.message}')));
  }

  @override
  void dispose() { _razorpay.clear(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Pay Fee')),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(children: [
        // Invoice summary card
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
          Text('Invoice: ${widget.invoice.invoiceNo}', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('Amount: ₹${widget.invoice.totalAmount}', style: Theme.of(context).textTheme.headlineSmall),
          Text('Due: ₹${widget.invoice.totalAmount - widget.invoice.paidAmount}',
              style: const TextStyle(color: Colors.red)),
        ]))),
        const Spacer(),
        SizedBox(width: double.infinity, child: ElevatedButton.icon(
          onPressed: _openCheckout,
          icon: const Icon(Icons.payment),
          label: const Text('Pay with Razorpay'),
          style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
        )),
      ]),
    ),
  );
}
```

## Testing — Phase 4

```python
@pytest.mark.asyncio
async def test_collect_fee_updates_invoice_status(db, school_id, student_id):
    invoice = await create_test_invoice(db, school_id, student_id, total=5000)
    payment = await fee_service.collect_fee(db, invoice.id, Decimal("5000"), "cash", STAFF_ID)
    assert payment.receipt_no.startswith("RCP-")
    updated = await db.get(FeeInvoice, invoice.id)
    assert updated.status == "paid"
    assert updated.paid_amount == Decimal("5000")

@pytest.mark.asyncio
async def test_partial_payment_sets_partial_status(db, school_id, student_id):
    invoice = await create_test_invoice(db, school_id, student_id, total=5000)
    await fee_service.collect_fee(db, invoice.id, Decimal("2000"), "cash", STAFF_ID)
    updated = await db.get(FeeInvoice, invoice.id)
    assert updated.status == "partial"

@pytest.mark.asyncio
async def test_razorpay_webhook_marks_paid(auth_client):
    # Simulate Razorpay webhook with valid signature
    payload = b'{"event":"payment.captured","payload":{"payment":{"entity":{"order_id":"order_123"}}}}'
    sig = hmac.new(b"test_secret", payload, hashlib.sha256).hexdigest()
    res = await auth_client.post("/api/v1/fees/webhook/razorpay", content=payload,
                                 headers={"X-Razorpay-Signature": sig})
    assert res.status_code == 200

@pytest.mark.asyncio
async def test_tally_export_valid_xml(auth_client):
    res = await auth_client.get("/api/v1/fees/export/tally?from_date=2024-10-01&to_date=2024-10-31")
    assert res.status_code == 200
    assert b"<ENVELOPE>" in res.content
    assert b"TALLYMESSAGE" in res.content
```

## Antigravity Prompt for Phase 4

```
@file skills/master-plan/SKILL.md
@file skills/phase-04-finance/SKILL.md

Build Phase 4 — Finance:
1. Add all SQLAlchemy models + Alembic migration
2. Build fee structure API (CRUD, class-wise amounts)
3. Build invoice generator (bulk generate for entire class as Celery task)
4. Build payment gateway adapters: RazorpayGateway + StripeGateway (ABC base class)
5. Build fee collection endpoint (cash/cheque) + webhook endpoints for Razorpay + Stripe
6. Generate PDF receipts via WeasyPrint + Jinja2 template
7. Build concession service (scholarship, sibling, custom discount applied to invoice)
8. Build expense ledger CRUD + monthly summary
9. Build Tally ERP 9 XML export endpoint
10. Flutter fee list screen with status chips + InvoiceDetailSheet
11. Flutter payment screen with razorpay_flutter SDK integration
12. Flutter financial dashboard screen with fl_chart bar chart (monthly collection)
13. Write all tests: pytest + flutter_test
```
