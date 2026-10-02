---
name: schoolerp-phase-10-security
description: >
  Phase 10 of SchoolERP (Python + Flutter) — Gate Pass Management (QR approval,
  multi-level chain, gate terminal, attendance write-back, parent SMS), CCTV
  5-gate consent system, Compliance document vault with expiry Celery alerts,
  Campus Workers Register with QR badge and gate scanner.
---
# Phase 10 — Security & Governance
## Python FastAPI · Celery · Flutter

## SQLAlchemy Models

```python
# api/app/models/security.py
class GatePass(Base):
    __tablename__ = "gate_passes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    pass_type: Mapped[str] = mapped_column(String(20))  # student_exit|staff_leave
    requested_for: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # student or staff id
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    exit_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    return_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    qr_token: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class GateLog(Base):
    __tablename__ = "gate_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    gate_pass_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("gate_passes.id"), nullable=True)
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    person_type: Mapped[str] = mapped_column(String(20))  # student|staff|worker|visitor
    direction: Mapped[str] = mapped_column(String(10))    # in|out
    method: Mapped[str] = mapped_column(String(20))       # qr|manual|biometric
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    logged_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

class CctvCamera(Base):
    __tablename__ = "cctv_cameras"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(200))
    stream_url: Mapped[str] = mapped_column(String(500))  # RTSP or HLS
    section_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

class CctvConsent(Base):
    __tablename__ = "cctv_consents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    camera_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cctv_cameras.id"))
    gate: Mapped[int] = mapped_column()  # 1-5
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("parent_id", "camera_id", "gate"),)

class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="valid")  # valid|expiring_soon|expired|missing
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class CampusWorker(Base):
    __tablename__ = "campus_workers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(50))  # housekeeping|security|canteen|gardener
    contractor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str] = mapped_column(String(20))
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    badge_qr: Mapped[str] = mapped_column(String(200), unique=True)
    is_active: Mapped[bool] = mapped_column(default=True)
```

## Gate Pass Service

```python
# api/app/services/gate_pass_service.py
import secrets, qrcode
from io import BytesIO

async def approve_gate_pass(db: AsyncSession, pass_id: uuid.UUID, approved_by: uuid.UUID) -> GatePass:
    gate_pass = await db.get(GatePass, pass_id)
    if not gate_pass or gate_pass.status != "pending":
        raise BadRequestException("Pass not in pending state")

    # Generate QR token
    qr_token = secrets.token_urlsafe(32)
    gate_pass.status = "approved"
    gate_pass.approved_by = approved_by
    gate_pass.approved_at = datetime.utcnow()
    gate_pass.qr_token = qr_token
    await db.commit()

    # Notify parent via SMS/WhatsApp
    if gate_pass.pass_type == "student_exit":
        student = await db.get(Student, gate_pass.requested_for)
        parents = student.parents
        for parent in parents:
            gateway = get_sms_gateway(student.school.settings)
            await gateway.send(parent.phone,
                f"Gate pass approved for {student.first_name}. Exit time: {gate_pass.exit_time.strftime('%H:%M')}")
    return gate_pass

async def scan_gate_pass_qr(db: AsyncSession, qr_token: str, logged_by: uuid.UUID) -> dict:
    gate_pass = await db.scalar(select(GatePass).where(GatePass.qr_token == qr_token))
    if not gate_pass:
        return {"status": "invalid", "message": "QR code not found"}
    if gate_pass.status != "approved":
        return {"status": "rejected", "message": f"Pass is {gate_pass.status}"}
    if gate_pass.used_at:
        return {"status": "rejected", "message": "Pass already used"}

    # Mark used
    gate_pass.used_at = datetime.utcnow()
    gate_pass.status = "used"

    # Log gate entry
    log = GateLog(school_id=gate_pass.school_id, gate_pass_id=gate_pass.id,
                  person_id=gate_pass.requested_for, person_type="student",
                  direction="out", method="qr", logged_by=logged_by)
    db.add(log)

    # Auto attendance write-back: mark absent from exit time
    if gate_pass.pass_type == "student_exit":
        await write_back_attendance_absent(db, gate_pass.requested_for, gate_pass.exit_time)

    await db.commit()
    person = await db.get(Student, gate_pass.requested_for)
    return {"status": "approved", "person": person, "pass": gate_pass}
```

## CCTV 5-Gate Consent System

```python
# api/app/services/cctv_service.py

async def can_parent_view_camera(
    db: AsyncSession,
    redis: Redis,
    parent_id: uuid.UUID,
    camera_id: uuid.UUID,
    school_id: uuid.UUID,
) -> tuple[bool, str]:
    """
    All 5 gates must pass. Returns (can_view, reason_if_denied).
    Gate 1: module enabled for school
    Gate 2: camera assigned to student's section
    Gate 3: parent has consented (all 5 gate records exist + not revoked)
    Gate 4: current time within school viewing hours
    Gate 5: parent account is active and verified
    """
    # Gate 1
    if not await is_module_enabled(db, school_id, "cctv"):
        return False, "CCTV module not enabled"

    # Gate 2
    camera = await db.get(CctvCamera, camera_id)
    if not camera or not camera.section_id:
        return False, "Camera not assigned to a section"
    student = await get_parent_active_student(db, parent_id)
    if not student or student.section_id != camera.section_id:
        return False, "Camera not assigned to your child's section"

    # Gate 3: all 5 gate records must exist and not be revoked
    consent_count = await db.scalar(
        select(func.count()).where(
            CctvConsent.parent_id == parent_id,
            CctvConsent.camera_id == camera_id,
            CctvConsent.revoked_at == None,
        )
    )
    if consent_count < 5:
        return False, "Consent not fully granted"

    # Gate 4: within school viewing hours (e.g. 7am–5pm)
    school = await db.get(School, school_id)
    tz = pytz.timezone(school.timezone)
    now_local = datetime.now(tz)
    viewing_start = now_local.replace(hour=7, minute=0, second=0)
    viewing_end = now_local.replace(hour=17, minute=0, second=0)
    if not (viewing_start <= now_local <= viewing_end):
        return False, "Outside viewing hours (7AM–5PM)"

    # Gate 5
    parent_user = await db.scalar(select(User).where(User.id == parent_id))
    if not parent_user or not parent_user.is_active:
        return False, "Parent account not active"

    return True, ""
```

## Compliance Expiry Celery Task

```python
# api/app/tasks/compliance_tasks.py
@shared_task
def check_document_expiry():
    """Runs daily. Flags documents expiring within 30 days and sends alerts."""
    import asyncio
    asyncio.run(_check_expiry())

async def _check_expiry():
    async with AsyncSessionLocal() as db:
        today = date.today()
        warning_date = today + timedelta(days=30)

        # Update status of expiring/expired docs
        await db.execute(
            update(ComplianceDocument)
            .where(ComplianceDocument.expiry_date <= today)
            .values(status="expired")
        )
        await db.execute(
            update(ComplianceDocument)
            .where(ComplianceDocument.expiry_date > today,
                   ComplianceDocument.expiry_date <= warning_date)
            .values(status="expiring_soon")
        )
        await db.commit()

        # Alert admins for expiring documents
        expiring = await db.scalars(
            select(ComplianceDocument).where(ComplianceDocument.status == "expiring_soon")
        )
        for doc in expiring.all():
            admin_phones = await get_admin_phones(db, doc.school_id)
            school = await db.get(School, doc.school_id)
            gw = get_sms_gateway(school.settings)
            days_left = (doc.expiry_date - today).days
            for phone in admin_phones:
                await gw.send(phone, f"⚠️ Compliance Alert: '{doc.name}' expires in {days_left} days. Please renew.")
```

## Flutter — Gate Terminal (Kiosk Mode)

```dart
// lib/features/security/screens/gate_terminal_screen.dart
// Full-screen QR scanner (mobile_scanner)
// Large photo + name overlay on scan result
// Green background = approved, Red = rejected/invalid
// Auto-resets after 3 seconds

class GateTerminalScreen extends ConsumerStatefulWidget {
  const GateTerminalScreen({super.key});
  @override
  ConsumerState<GateTerminalScreen> createState() => _GateTerminalState();
}

class _GateTerminalState extends ConsumerState<GateTerminalScreen> {
  ScanResult? _result;
  bool _processing = false;
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.normal);

  Future<void> _onScan(BarcodeCapture capture) async {
    if (_processing || _result != null) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;

    setState(() => _processing = true);

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/v1/security/gate-passes/scan', data: {'qr_token': raw});
      final data = res['data'] as Map<String, dynamic>;
      setState(() => _result = ScanResult.fromJson(data));
      HapticFeedback.heavyImpact();
    } catch (_) {
      setState(() => _result = ScanResult.invalid());
    } finally {
      setState(() => _processing = false);
      // Auto-reset after 3 seconds
      await Future.delayed(const Duration(seconds: 3));
      setState(() => _result = null);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _result == null ? Colors.black
        : (_result!.isApproved ? Colors.green.shade700 : Colors.red.shade700),
    body: _result != null
        ? _buildResultOverlay()
        : MobileScanner(controller: _controller, onDetect: _onScan),
  );

  Widget _buildResultOverlay() => Center(child: Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      if (_result!.photoUrl != null)
        CircleAvatar(radius: 60, backgroundImage: NetworkImage(_result!.photoUrl!)),
      const SizedBox(height: 16),
      Text(_result!.personName, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
      Text(_result!.message, style: const TextStyle(color: Colors.white70, fontSize: 18)),
      const SizedBox(height: 24),
      Icon(_result!.isApproved ? Icons.check_circle : Icons.cancel,
           color: Colors.white, size: 80),
    ],
  ));

  @override
  void dispose() { _controller.dispose(); super.dispose(); }
}
```

## Flutter — Gate Pass Request Screen

```dart
// lib/features/security/screens/gate_pass_request_screen.dart
// Form: reason TextField, exit time DateTimePicker, return time (optional)
// Submit → POST /api/v1/security/gate-passes
// Shows pending status + "awaiting approval" banner
// On approval: shows QR code image (via qr_flutter package)

// lib/features/security/screens/gate_passes_list_screen.dart (for admin)
// List of pending passes with Approve/Reject buttons
// Filter: pending|approved|used|rejected
```

## Testing — Phase 10

```python
@pytest.mark.asyncio
async def test_approve_generates_qr_token(db, auth_client):
    gate_pass = await create_gate_pass(db, status="pending")
    res = await auth_client.put(f"/api/v1/security/gate-passes/{gate_pass.id}/approve")
    assert res.status_code == 200
    updated = await db.get(GatePass, gate_pass.id)
    assert updated.qr_token is not None
    assert updated.status == "approved"

@pytest.mark.asyncio
async def test_scan_used_pass_rejected(db, auth_client):
    gate_pass = await create_gate_pass(db, status="approved", used_at=datetime.utcnow())
    res = await auth_client.post("/api/v1/security/gate-passes/scan",
                                  json={"qr_token": gate_pass.qr_token})
    assert res.json()["data"]["status"] == "rejected"

@pytest.mark.asyncio
async def test_cctv_denied_without_all_5_gates(db):
    # Only 4 of 5 consent records present
    for gate in range(1, 5):
        await grant_consent(db, PARENT_ID, CAMERA_ID, gate)
    can_view, reason = await can_parent_view_camera(db, redis, PARENT_ID, CAMERA_ID, SCHOOL_ID)
    assert can_view is False
    assert "Consent" in reason

@pytest.mark.asyncio
async def test_cctv_allowed_with_all_5_gates(db, mock_time_within_hours):
    for gate in range(1, 6):
        await grant_consent(db, PARENT_ID, CAMERA_ID, gate)
    can_view, _ = await can_parent_view_camera(db, redis, PARENT_ID, CAMERA_ID, SCHOOL_ID)
    assert can_view is True

@pytest.mark.asyncio
async def test_compliance_expiry_updates_status(db):
    doc = await create_doc(db, expiry_date=date.today() - timedelta(days=1))
    await _check_expiry()
    updated = await db.get(ComplianceDocument, doc.id)
    assert updated.status == "expired"
```

## Antigravity Prompt for Phase 10

```
@file skills/master-plan/SKILL.md
@file skills/phase-10-security/SKILL.md

Build Phase 10 — Security & Governance:
1. All SQLAlchemy models + Alembic migration
2. Gate pass: create, multi-level approval (generate QR token via secrets.token_urlsafe),
   scan endpoint (validate + mark used + attendance write-back + parent SMS)
3. CCTV: camera CRUD, 5-gate consent system (all gates checked before returning stream URL)
4. Compliance: document vault CRUD with MinIO upload, Celery daily expiry check + SMS alert
5. Campus workers: register CRUD, QR badge generation (qrcode library), gate scan hook
6. Flutter gate terminal screen: full-screen mobile_scanner, green/red overlay, 3s auto-reset
7. Flutter gate pass request screen: form + QR code display on approval (qr_flutter package)
8. Flutter gate pass admin screen: pending list with approve/reject buttons
9. All tests: pytest (QR generation, scan-used-pass, 5-gate CCTV, compliance expiry) + flutter_test
```
