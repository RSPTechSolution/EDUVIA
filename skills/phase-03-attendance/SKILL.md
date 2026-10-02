---
name: schoolerp-phase-03-attendance
description: >
  Phase 3 of SchoolERP (Python + Flutter) — biometric 2-way ADMS sync for
  ZKTeco/eSSL devices, QR code attendance with mobile_scanner, manual attendance,
  period-wise marking, and attendance reports. Use when building attendance,
  biometric sync, QR scanning, or attendance analytics.
---
# Phase 3 — Attendance Modules
## Python FastAPI · Celery · Flutter

## SQLAlchemy Models

```python
# api/app/models/attendance.py
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20))  # present|absent|late|half_day
    period: Mapped[int | None] = mapped_column(nullable=True)  # null=daily, 1-8=period
    marked_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    method: Mapped[str] = mapped_column(String(20))  # manual|biometric|qr_scan
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("student_id", "date", "period"),
        Index("ix_att_school_section_date", "school_id", "section_id", "date"),
    )

class BiometricDevice(Base):
    __tablename__ = "biometric_devices"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    device_id: Mapped[str] = mapped_column(String(50), unique=True)  # ZKTeco serial
    name: Mapped[str] = mapped_column(String(100))
    ip_address: Mapped[str] = mapped_column(String(45))
    punch_mode: Mapped[str] = mapped_column(String(10), default="both")  # in|out|both
    is_active: Mapped[bool] = mapped_column(default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class BiometricPunch(Base):
    __tablename__ = "biometric_punches"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    device_id: Mapped[str] = mapped_column(String(50))
    person_id: Mapped[str] = mapped_column(String(50))  # employee/student ID on device
    punch_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    punch_type: Mapped[int] = mapped_column()  # 0=in, 1=out
    processed: Mapped[bool] = mapped_column(default=False)
    __table_args__ = (UniqueConstraint("device_id", "person_id", "punch_time"),)

class QrScanLog(Base):
    __tablename__ = "qr_scan_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    scanned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    mode: Mapped[str] = mapped_column(String(20))  # gate|classroom
```

## ZKTeco ADMS Endpoint (Public — No Auth)

```python
# api/app/routers/biometric_adms.py
# This router is mounted WITHOUT auth middleware — devices call it directly
from fastapi import APIRouter, Request, Query
from fastapi.responses import PlainTextResponse

adms_router = APIRouter()

@adms_router.get("/iclock/cdata", response_class=PlainTextResponse)
async def device_handshake(SN: str = Query(...), db: AsyncSession = Depends(get_db)):
    device = await db.scalar(
        select(BiometricDevice).where(BiometricDevice.device_id == SN, BiometricDevice.is_active == True)
    )
    if not device:
        return PlainTextResponse("Error: Unauthorized device", status_code=403)
    # Return server time + config to device
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    return PlainTextResponse(
        f"GET OPTION FROM:{SN}\nATTLOGStamp=9999\nOPERLOGStamp=9999\nATTPHOTO=0\nServerTime={now}\n"
    )

@adms_router.post("/iclock/cdata", response_class=PlainTextResponse)
async def receive_punches(
    request: Request,
    SN: str = Query(...),
    table: str = Query("ATTLOG"),
    db: AsyncSession = Depends(get_db),
):
    if table != "ATTLOG":
        return PlainTextResponse("OK")

    device = await db.scalar(select(BiometricDevice).where(BiometricDevice.device_id == SN))
    if not device:
        return PlainTextResponse("Error", status_code=403)

    body = (await request.body()).decode("utf-8").strip()
    punches = []
    for line in body.split("\n"):
        parts = line.strip().split("\t")
        if len(parts) < 3:
            continue
        person_id, punch_time_str, punch_type = parts[0], parts[1], int(parts[2]) if len(parts) > 2 else 0
        try:
            punch_time = datetime.strptime(punch_time_str.strip(), "%Y-%m-%d %H:%M:%S")
            punches.append(BiometricPunch(
                school_id=device.school_id,
                device_id=SN,
                person_id=person_id.strip(),
                punch_time=punch_time,
                punch_type=punch_type,
            ))
        except ValueError:
            continue

    if punches:
        db.add_all(punches)
        device.last_sync_at = datetime.utcnow()
        await db.commit()
        # Queue Celery task to process punches into attendance records
        process_biometric_punches.delay(SN, str(device.school_id))

    return PlainTextResponse("OK")
```

## Celery Task — Process Punches

```python
# api/app/tasks/attendance_tasks.py
from celery import shared_task
from app.core.database import AsyncSessionLocal
from app.models.attendance import BiometricPunch, AttendanceRecord

@shared_task
def process_biometric_punches(device_id: str, school_id: str):
    import asyncio
    asyncio.run(_process(device_id, school_id))

async def _process(device_id: str, school_id: str):
    async with AsyncSessionLocal() as db:
        punches = await db.scalars(
            select(BiometricPunch).where(
                BiometricPunch.device_id == device_id,
                BiometricPunch.processed == False,
            ).order_by(BiometricPunch.punch_time)
        )
        for punch in punches.all():
            # Match person_id to student or staff
            student = await match_person_to_student(db, punch.person_id, school_id)
            if student:
                punch_date = punch.punch_time.date()
                existing = await db.scalar(
                    select(AttendanceRecord).where(
                        AttendanceRecord.student_id == student.id,
                        AttendanceRecord.date == punch_date,
                        AttendanceRecord.period == None,
                    )
                )
                if not existing:
                    record = AttendanceRecord(
                        school_id=uuid.UUID(school_id),
                        student_id=student.id,
                        section_id=student.section_id,
                        date=punch_date,
                        status="present",
                        method="biometric",
                        marked_by=student.id,
                    )
                    db.add(record)
            punch.processed = True
        await db.commit()
```

## QR Scan API with Redis Anti-Loop

```python
# api/app/routers/attendance.py
@router.post("/qr-scan")
async def qr_scan(
    body: QrScanRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user = Depends(get_current_user),
):
    # Anti-scan-loop: block re-scan within 10 minutes
    cache_key = f"qr_scan:{body.student_id}:{body.mode}"
    if await redis.get(cache_key):
        raise HTTPException(status_code=429, detail={"code": "ALREADY_SCANNED", "message": "Student already scanned within 10 minutes"})

    # Mark attendance
    record = AttendanceRecord(
        school_id=current_user.school_id,
        student_id=body.student_id,
        section_id=await get_student_section(db, body.student_id),
        date=date.today(),
        status="present",
        method="qr_scan",
        marked_by=current_user.id,
    )
    db.add(record)
    scan_log = QrScanLog(school_id=current_user.school_id, student_id=body.student_id,
                         scanned_by=current_user.id, mode=body.mode)
    db.add(scan_log)
    await db.commit()

    # Set Redis anti-loop key (10 minutes TTL)
    await redis.setex(cache_key, 600, "1")

    student = await db.get(Student, body.student_id)
    return ApiResponse(data={"student": student, "status": "marked_present"})
```

## Flutter — QR Scanner Screen

```dart
// lib/features/attendance/screens/qr_scanner_screen.dart
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/attendance_provider.dart';

class QrScannerScreen extends ConsumerStatefulWidget {
  const QrScannerScreen({super.key});
  @override
  ConsumerState<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends ConsumerState<QrScannerScreen> {
  final _controller = MobileScannerController();
  bool _isProcessing = false;
  String? _lastResult;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QR Attendance'), actions: [
        IconButton(icon: const Icon(Icons.flash_on), onPressed: _controller.toggleTorch),
      ]),
      body: Stack(children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
        ),
        // Scan overlay
        Center(child: Container(
          width: 250, height: 250,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.green, width: 3),
            borderRadius: BorderRadius.circular(16),
          ),
        )),
        // Last scan result
        if (_lastResult != null) Positioned(
          bottom: 40, left: 16, right: 16,
          child: Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(_lastResult!, style: const TextStyle(fontSize: 16)),
          )),
        ),
      ]),
    );
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode?.rawValue == null) return;

    setState(() => _isProcessing = true);

    try {
      final qrData = barcode!.rawValue!;
      // QR contains: {"student_id": "...", "school_id": "..."}
      final parsed = jsonDecode(qrData) as Map<String, dynamic>;
      final studentId = parsed['student_id'] as String;

      final result = await ref.read(attendanceNotifierProvider.notifier)
          .processQrScan(studentId, 'gate');

      setState(() => _lastResult = '✅ ${result['student']['first_name']} marked present');
      HapticFeedback.mediumImpact();
    } catch (e) {
      final msg = e.toString().contains('ALREADY_SCANNED')
          ? '⚠️ Already scanned in last 10 minutes'
          : '❌ Scan failed';
      setState(() => _lastResult = msg);
      HapticFeedback.vibrate();
    } finally {
      // Re-arm scanner after 2 seconds
      await Future.delayed(const Duration(seconds: 2));
      setState(() { _isProcessing = false; _lastResult = null; });
    }
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }
}
```

## Flutter — Manual Attendance Screen

```dart
// lib/features/attendance/screens/attendance_marking_screen.dart
// Shows student cards: photo + name + P/A/L/H buttons
// Floating "Save" button with count (25 P / 3 A)
// Pull-to-refresh, "Mark All Present" quick action
// Uses AttendanceNotifier.bulkMark(records) → POST /api/v1/attendance/{sectionId}

class AttendanceCard extends StatelessWidget {
  final Student student;
  final String status;
  final ValueChanged<String> onStatusChanged;

  const AttendanceCard({super.key, required this.student, required this.status, required this.onStatusChanged});

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: CircleAvatar(
        backgroundImage: student.photo != null ? NetworkImage(student.photo!) : null,
        child: student.photo == null ? Text(student.firstName[0]) : null,
      ),
      title: Text('${student.firstName} ${student.lastName}'),
      subtitle: Text('Roll: ${student.admissionNo}'),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final s in ['P', 'A', 'L', 'H'])
          GestureDetector(
            onTap: () => onStatusChanged(s.toLowerCase()),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: status == s.toLowerCase() ? _statusColor(s) : Colors.grey.shade200,
                shape: BoxShape.circle,
              ),
              child: Text(s, style: TextStyle(
                color: status == s.toLowerCase() ? Colors.white : Colors.black87,
                fontWeight: FontWeight.bold, fontSize: 12,
              )),
            ),
          ),
      ]),
    ),
  );

  Color _statusColor(String s) => switch (s) {
    'P' => Colors.green, 'A' => Colors.red, 'L' => Colors.orange, _ => Colors.blue,
  };
}
```

## Testing Guide — Phase 3

```python
# api/tests/integration/test_attendance.py

@pytest.mark.asyncio
async def test_adms_handshake_authorized_device(client):
    res = await client.get("/iclock/cdata?SN=DEVICE001")
    assert res.status_code == 200
    assert "ATTLOGStamp" in res.text

@pytest.mark.asyncio
async def test_adms_handshake_unauthorized_device(client):
    res = await client.get("/iclock/cdata?SN=UNKNOWN")
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_adms_receives_punches(client, db):
    punch_data = "00001\t2024-10-15 08:30:00\t0\t0\t0\n00002\t2024-10-15 08:32:00\t0\t0\t0"
    res = await client.post("/iclock/cdata?SN=DEVICE001&table=ATTLOG",
                            content=punch_data, headers={"Content-Type": "text/plain"})
    assert res.text == "OK"
    count = await db.scalar(select(func.count()).where(BiometricPunch.device_id == "DEVICE001"))
    assert count == 2

@pytest.mark.asyncio
async def test_qr_scan_anti_loop(auth_client, redis_client):
    await auth_client.post("/api/v1/attendance/qr-scan",
                           json={"student_id": STUDENT_ID, "mode": "gate"})
    res = await auth_client.post("/api/v1/attendance/qr-scan",
                                 json={"student_id": STUDENT_ID, "mode": "gate"})
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "ALREADY_SCANNED"

@pytest.mark.asyncio
async def test_bulk_attendance_mark(auth_client):
    records = [
        {"student_id": STUDENT_1, "status": "present"},
        {"student_id": STUDENT_2, "status": "absent"},
    ]
    res = await auth_client.post(f"/api/v1/attendance/{SECTION_ID}",
                                 json={"date": "2024-10-15", "records": records})
    assert res.status_code == 200
    assert res.json()["data"]["saved"] == 2
```

```dart
// test/features/attendance/qr_scanner_test.dart
void main() {
  group('QR Attendance', () {
    testWidgets('shows success overlay after valid scan', (tester) async {
      await tester.pumpWidget(buildTestApp(screen: const QrScannerScreen()));
      // Simulate QR detection
      // Assert green overlay shown with student name
    });

    test('anti-loop: second scan within 10min throws ALREADY_SCANNED', () async {
      final notifier = buildAttendanceNotifier(mockApi: mockApiWithAlreadyScanned());
      await notifier.processQrScan(STUDENT_ID, 'gate'); // first succeeds
      expect(() => notifier.processQrScan(STUDENT_ID, 'gate'),
             throwsA(predicate((e) => e.toString().contains('ALREADY_SCANNED'))));
    });
  });
}
```

## Antigravity Prompt for Phase 3

```
@file skills/master-plan/SKILL.md
@file skills/phase-03-attendance/SKILL.md

Build Phase 3 — Attendance:
1. Add all SQLAlchemy models + Alembic migration
2. Build ADMS public router (/iclock/cdata GET + POST) — no auth required
3. Build Celery task to process biometric punches into attendance records
4. Build QR scan endpoint with Redis anti-loop (10-min TTL key)
5. Build bulk manual attendance marking endpoint (section + date + records)
6. Build attendance reports: daily, monthly calendar, <75% defaulter list
7. Flutter QR scanner screen using mobile_scanner package with re-arm logic
8. Flutter manual attendance screen with P/A/L/H card buttons and bulk save
9. Flutter attendance reports screen with monthly calendar grid (fl_chart or custom)
10. Write all tests: pytest (ADMS, anti-loop, bulk mark) + flutter_test
```
