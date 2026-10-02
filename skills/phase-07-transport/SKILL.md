---
name: schoolerp-phase-07-transport
description: >
  Phase 7 of SchoolERP (Python + Flutter) — GPS transport: driver enrolment
  (Driver ID + PIN + QR), route builder, trip lifecycle, batch GPS pings,
  boarding register with SQLite offline queue, Socket.io live ops console,
  Leaflet map in Next.js, SOS with Firebase push.
---
# Phase 7 — Transport & GPS
## Python FastAPI · python-socketio · Flutter (geolocator + background_fetch)

## SQLAlchemy Models

```python
# api/app/models/transport.py
class Driver(Base):
    __tablename__ = "drivers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    driver_id: Mapped[str] = mapped_column(String(20), unique=True)  # e.g. DRV-00342
    pin_hash: Mapped[str] = mapped_column(String(200))
    qr_token: Mapped[str] = mapped_column(String(200), unique=True)
    license_no: Mapped[str] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(default=True)

class Route(Base):
    __tablename__ = "routes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(String(100))
    driver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

class RouteStop(Base):
    __tablename__ = "route_stops"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"))
    name: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 8))
    longitude: Mapped[Decimal] = mapped_column(Numeric(11, 8))
    order_index: Mapped[int] = mapped_column()
    expected_time: Mapped[str] = mapped_column(String(5))  # "07:30"

class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"))
    driver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    date: Mapped[date] = mapped_column(Date)
    direction: Mapped[str] = mapped_column(String(20))  # morning|afternoon
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class TripGpsLog(Base):
    __tablename__ = "trip_gps_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"))
    lat: Mapped[Decimal] = mapped_column(Numeric(10, 8))
    lng: Mapped[Decimal] = mapped_column(Numeric(11, 8))
    speed: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class TripBoarding(Base):
    __tablename__ = "trip_boardings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    stop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("route_stops.id"))
    status: Mapped[str] = mapped_column(String(20))  # boarded|absent|skipped
    boarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("trip_id", "student_id"),)
```

## GPS Batch Endpoint + Socket Emit

```python
# api/app/routers/transport.py
@router.post("/trips/{trip_id}/gps")
async def receive_gps_batch(
    trip_id: uuid.UUID,
    pings: list[GpsPing],
    db: AsyncSession = Depends(get_db),
    current_driver = Depends(get_current_driver),  # uses Driver token
):
    logs = [TripGpsLog(trip_id=trip_id, lat=p.lat, lng=p.lng, speed=p.speed) for p in pings]
    db.add_all(logs)
    await db.commit()

    # Emit last position to admin live ops room
    if pings:
        last = pings[-1]
        await sio.emit("trip_update", {
            "trip_id": str(trip_id),
            "lat": float(last.lat), "lng": float(last.lng), "speed": float(last.speed or 0),
        }, room="transport_live")

    return ApiResponse(data={"saved": len(logs)})

@router.post("/sos")
async def send_sos(
    body: SosRequest,
    db: AsyncSession = Depends(get_db),
    current_driver = Depends(get_current_driver),
):
    # Save SOS record
    sos = Sos(driver_id=current_driver.id, trip_id=body.trip_id,
               lat=body.lat, lng=body.lng, school_id=current_driver.school_id)
    db.add(sos)
    await db.commit()
    # Firebase push to all school admins
    await send_firebase_push_to_admins(
        school_id=current_driver.school_id,
        title="🚨 SOS Alert",
        body=f"Driver {current_driver.driver_id} sent SOS",
        data={"type": "sos", "trip_id": str(body.trip_id)},
    )
    return ApiResponse(data={"message": "SOS sent"})
```

## Flutter Driver App — Background GPS

```dart
// lib/features/transport/services/gps_service.dart
import 'package:geolocator/geolocator.dart';
import 'package:background_fetch/background_fetch.dart';
import 'package:sqflite/sqflite.dart';

class GpsService {
  static const _taskId = 'driver-gps-task';
  static Database? _db;

  static Future<void> init() async {
    _db = await openDatabase('gps_queue.db', version: 1, onCreate: (db, _) {
      db.execute('''CREATE TABLE gps_queue(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT, lat REAL, lng REAL, speed REAL, logged_at TEXT, synced INTEGER DEFAULT 0
      )''');
    });
  }

  static Future<void> startTracking(String tripId) async {
    await BackgroundFetch.configure(
      BackgroundFetchConfig(minimumFetchInterval: 1, stopOnTerminate: false, enableHeadless: true),
      (taskId) async {
        await _captureAndQueue(tripId);
        BackgroundFetch.finish(taskId);
      },
    );
    await BackgroundFetch.start();
  }

  static Future<void> _captureAndQueue(String tripId) async {
    final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    await _db!.insert('gps_queue', {
      'trip_id': tripId, 'lat': pos.latitude, 'lng': pos.longitude,
      'speed': pos.speed, 'logged_at': DateTime.now().toIso8601String(), 'synced': 0,
    });
    await _syncQueue(tripId);
  }

  static Future<void> _syncQueue(String tripId) async {
    final rows = await _db!.query('gps_queue', where: 'synced = 0 AND trip_id = ?', whereArgs: [tripId]);
    if (rows.isEmpty) return;
    try {
      final api = GetIt.I<ApiClient>();
      await api.post('/api/v1/transport/trips/$tripId/gps', data: {
        'pings': rows.map((r) => {'lat': r['lat'], 'lng': r['lng'], 'speed': r['speed']}).toList(),
      });
      final ids = rows.map((r) => r['id']).join(',');
      await _db!.rawUpdate('UPDATE gps_queue SET synced = 1 WHERE id IN ($ids)');
    } catch (_) {
      // Network down — leave in queue, retry next cycle
    }
  }

  static Future<void> stopTracking() => BackgroundFetch.stop();
}
```

## Flutter — SOS Hold-to-Send

```dart
// lib/features/transport/widgets/sos_button.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class SosButton extends StatefulWidget {
  final VoidCallback onSosTriggered;
  const SosButton({super.key, required this.onSosTriggered});
  @override
  State<SosButton> createState() => _SosButtonState();
}

class _SosButtonState extends State<SosButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 3));
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        HapticFeedback.heavyImpact();
        widget.onSosTriggered();
        _controller.reset();
      }
    });
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onLongPressStart: (_) => _controller.forward(),
    onLongPressEnd: (_) => _controller.reverse(),
    child: AnimatedBuilder(
      animation: _controller,
      builder: (_, child) => Container(
        width: 120, height: 120,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.red.withOpacity(0.1),
          border: Border.all(color: Colors.red, width: 3),
        ),
        child: Stack(alignment: Alignment.center, children: [
          SizedBox(width: 120, height: 120, child: CircularProgressIndicator(
            value: _controller.value, color: Colors.red, strokeWidth: 6,
          )),
          Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.warning_rounded, color: Colors.red, size: 32),
            Text(_controller.value > 0 ? 'Hold...' : 'SOS',
              style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ]),
        ]),
      ),
    ),
  );

  @override
  void dispose() { _controller.dispose(); super.dispose(); }
}
```

## Testing — Phase 7

```python
@pytest.mark.asyncio
async def test_gps_batch_stored_and_emitted(driver_client, mock_sio):
    pings = [{"lat": 30.7333, "lng": 76.7794, "speed": 40.0}]
    res = await driver_client.post(f"/api/v1/transport/trips/{TRIP_ID}/gps", json={"pings": pings})
    assert res.status_code == 200
    assert res.json()["data"]["saved"] == 1
    mock_sio.emit.assert_called_once_with("trip_update", ANY, room="transport_live")

@pytest.mark.asyncio
async def test_sos_sends_firebase_push(driver_client, mock_firebase):
    res = await driver_client.post("/api/v1/transport/sos",
                                   json={"trip_id": str(TRIP_ID), "lat": 30.73, "lng": 76.77})
    assert res.status_code == 200
    mock_firebase.send_push.assert_called_once()
    call_args = mock_firebase.send_push.call_args
    assert call_args.kwargs["title"] == "🚨 SOS Alert"
```

## Antigravity Prompt for Phase 7

```
@file skills/master-plan/SKILL.md
@file skills/phase-07-transport/SKILL.md

Build Phase 7 — Transport:
1. All SQLAlchemy models + Alembic migration
2. Driver enrolment: unique Driver ID (DRV-XXXXX) + bcrypt PIN + QR token
3. Driver-specific JWT auth endpoint (Driver ID + PIN → driver_token)
4. Trip management: start, GPS batch endpoint, boarding register, complete
5. Socket.io emit on GPS ping to 'transport_live' admin room
6. SOS endpoint with Firebase push to all school admins
7. Next.js live ops page: Leaflet map with Socket.io bus icons, click for trip details
8. Flutter Driver App: background_fetch GPS capture → sqflite offline queue → batch sync
9. Flutter Driver SOS button: hold-3s AnimationController → trigger SOS
10. Flutter boarding register: list students per stop, mark boarded/absent
11. All tests: pytest (GPS batch, SOS Firebase mock, offline sync logic) + flutter_test
```
