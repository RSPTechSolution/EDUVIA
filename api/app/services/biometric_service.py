"""Fingerprint/face attendance machines (ZKTeco and other ADMS "push" devices).

The machine is pointed at this server ("Cloud server" / ADMS settings: host and port of the API). It then
calls /iclock/cdata to fetch its settings and to upload punches, and /iclock/getrequest to poll for
commands. Each machine must first be registered under its serial number in Settings > Devices.

A student's first punch of the day marks them present (or late after the school's cut-off). Every punch is
kept, matched or not, so staff attendance can use them too.
"""
import logging
import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import elevated, set_tenant
from app.core.errors import Conflict, NotFound
from app.models import AttendanceRecord, BiometricDevice, BiometricPunch, School, Student, User
from app.schemas.attendance_extra import BiometricIds, DeviceIn, DeviceOut, PunchOut
from app.services import audit_service
from app.services.academics_service import field_error
from app.services.attendance_extra_service import closed_days

log = logging.getLogger("eduvia.biometric")
ONLINE = timedelta(minutes=5)


# ---- devices (Settings) -----------------------------------------------------------------------

def _out(d: BiometricDevice) -> DeviceOut:
    return DeviceOut(id=d.id, serial_no=d.serial_no, name=d.name, location=d.location, is_enabled=d.is_enabled, last_seen=d.last_seen,
                     punches=d.punches, online=bool(d.last_seen and datetime.now(UTC) - d.last_seen < ONLINE))


async def list_devices(db: AsyncSession, user: User) -> list[DeviceOut]:
    return [_out(d) for d in (await db.scalars(select(BiometricDevice).where(BiometricDevice.school_id == user.school_id)
                                               .order_by(BiometricDevice.name))).all()]


async def add_device(db: AsyncSession, user: User, data: DeviceIn) -> DeviceOut:
    async with elevated(db):  # serial numbers are unique across every school
        taken = await db.scalar(select(BiometricDevice.id).where(func.upper(BiometricDevice.serial_no) == data.serial_no.upper()))
    if taken:
        raise field_error("serial_no", "A device with this serial number is already registered")
    d = BiometricDevice(school_id=user.school_id, serial_no=data.serial_no.upper(), name=data.name, location=data.location,
                        is_enabled=data.is_enabled)
    db.add(d)
    await db.flush()
    await audit_service.record(db, "device.add", school_id=user.school_id, user_id=user.id, entity_type="device", entity_id=d.id,
                               meta={"serial_no": d.serial_no, "name": d.name})
    return _out(d)


async def _device(db: AsyncSession, user: User, device_id: uuid.UUID) -> BiometricDevice:
    d = await db.scalar(select(BiometricDevice).where(BiometricDevice.id == device_id, BiometricDevice.school_id == user.school_id))
    if not d:
        raise NotFound("Device not found")
    return d


async def update_device(db: AsyncSession, user: User, device_id: uuid.UUID, data: DeviceIn) -> DeviceOut:
    d = await _device(db, user, device_id)
    if data.serial_no.upper() != d.serial_no:
        raise Conflict("The serial number can't change. Remove the device and add it again.", code="SERIAL_FIXED")
    d.name, d.location, d.is_enabled = data.name, data.location, data.is_enabled
    await db.flush()
    return _out(d)


async def delete_device(db: AsyncSession, user: User, device_id: uuid.UUID) -> None:
    await db.delete(await _device(db, user, device_id))


async def recent_punches(db: AsyncSession, user: User, limit: int = 100) -> list[PunchOut]:
    rows = (await db.execute(select(BiometricPunch, BiometricDevice.name).join(BiometricDevice, BiometricDevice.id == BiometricPunch.device_id)
                             .where(BiometricPunch.school_id == user.school_id).order_by(BiometricPunch.punched_at.desc()).limit(limit))).all()
    sids = {p.student_id for p, _ in rows if p.student_id}
    uids = {p.user_id for p, _ in rows if p.user_id}
    students = {s.id: f"{s.first_name} {s.last_name}" for s in (await db.scalars(select(Student).where(Student.id.in_(sids)))).all()}
    users = dict((await db.execute(select(User.id, User.full_name).where(User.id.in_(uids)))).all())
    return [PunchOut(pin=p.pin, punched_at=p.punched_at, device=name,
                     matched=students.get(p.student_id) or users.get(p.user_id)) for p, name in rows]


async def set_ids(db: AsyncSession, user: User, data: BiometricIds) -> int:
    """Record the numbers people are enrolled under on the machines."""
    wanted = [(v, "student", k) for k, v in data.students.items() if v] + [(v, "user", k) for k, v in data.users.items() if v]
    seen: dict[str, str] = {}
    for pin, kind, ref in wanted:
        if pin in seen:
            raise field_error("pin", f"Number {pin} is given to two people")
        seen[pin] = f"{kind}:{ref}"
    changed = 0
    for sid, pin in data.students.items():
        s = await db.scalar(select(Student).where(Student.id == sid, Student.school_id == user.school_id))
        if not s:
            raise NotFound("Student not found")
        s.biometric_id, changed = pin or None, changed + 1
    for uid, pin in data.users.items():
        u = await db.scalar(select(User).where(User.id == uid, User.school_id == user.school_id))
        if not u:
            raise NotFound("User not found")
        u.biometric_id, changed = pin or None, changed + 1
    await db.flush()
    # Numbers must stay unique across students and staff.
    for pin in seen:
        n = (await db.scalar(select(func.count()).select_from(Student).where(Student.school_id == user.school_id, Student.biometric_id == pin)) or 0) + \
            (await db.scalar(select(func.count()).select_from(User).where(User.school_id == user.school_id, User.biometric_id == pin)) or 0)
        if n > 1:
            raise field_error("pin", f"Number {pin} is already used by someone else")
    return changed


# ---- ADMS (the machines call these) -------------------------------------------------------------

async def _machine(db: AsyncSession, serial: str) -> BiometricDevice | None:
    async with elevated(db):
        d = await db.scalar(select(BiometricDevice).where(func.upper(BiometricDevice.serial_no) == serial.upper()))
    if not d or not d.is_enabled:
        log.warning("ADMS call from unknown or disabled device %s", serial)
        return None
    await set_tenant(db, d.school_id)
    d.last_seen = datetime.now(UTC)
    return d


async def handshake(db: AsyncSession, serial: str) -> str | None:
    d = await _machine(db, serial)
    if not d:
        return None
    school = await db.get(School, d.school_id)
    tz = ZoneInfo(school.timezone or "Asia/Kolkata")
    offset = datetime.now(tz).utcoffset() or timedelta(0)
    return "\n".join([
        f"GET OPTION FROM: {d.serial_no}", "ATTLOGStamp=None", "OPERLOGStamp=9999", "ATTPHOTOStamp=None", "ErrorDelay=30", "Delay=10",
        "TransTimes=00:00;14:05", "TransInterval=1", "TransFlag=TransData AttLog", f"TimeZone={offset.total_seconds() / 3600:g}",
        "Realtime=1", "Encrypt=None", "",
    ])


async def receive(db: AsyncSession, serial: str, table: str, body: str) -> str | None:
    """Store uploaded punches (table=ATTLOG) and mark student attendance. Other tables are acknowledged."""
    d = await _machine(db, serial)
    if not d:
        return None
    if table.upper() != "ATTLOG":
        return "OK"
    school = await db.get(School, d.school_id)
    tz = ZoneInfo(school.timezone or "Asia/Kolkata")
    late_after = (school.settings or {}).get("late_after")
    rows = []
    for line in body.splitlines():
        parts = line.strip().split("\t")
        if len(parts) < 2 or not parts[0]:
            continue
        try:
            at = datetime.strptime(parts[1].strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz)
        except ValueError:
            continue
        rows.append((parts[0].strip()[:30], at))
    if not rows:
        return "OK: 0"
    pins = {p for p, _ in rows}
    students = {s.biometric_id: s for s in (await db.scalars(select(Student).where(
        Student.school_id == d.school_id, Student.biometric_id.in_(pins), Student.status == "active"))).all()}
    staff = dict((await db.execute(select(User.biometric_id, User.id).where(User.school_id == d.school_id, User.biometric_id.in_(pins)))).all())
    days = {at.date() for _, at in rows}
    closed = await closed_days(db, d.school_id, min(days), max(days))
    existing = {(a.student_id, a.date): a for a in (await db.scalars(select(AttendanceRecord).where(
        AttendanceRecord.student_id.in_([s.id for s in students.values()]), AttendanceRecord.date.in_(days)))).all()}
    seen = set((await db.execute(select(BiometricPunch.pin, BiometricPunch.punched_at).where(
        BiometricPunch.device_id == d.id, BiometricPunch.pin.in_(pins),
        BiometricPunch.punched_at >= min(at for _, at in rows)))).all())
    stored = 0
    for pin, at in sorted(rows, key=lambda r: r[1]):
        if (pin, at) in seen:
            continue  # machines resend after a lost connection
        seen.add((pin, at))
        s = students.get(pin)
        db.add(BiometricPunch(school_id=d.school_id, device_id=d.id, pin=pin, punched_at=at, student_id=s.id if s else None,
                              user_id=staff.get(pin)))
        stored += 1
        if s and at.date() not in closed:
            rec = existing.get((s.id, at.date()))
            status = "late" if late_after and at.strftime("%H:%M") > late_after else "present"
            if rec is None:
                rec = AttendanceRecord(school_id=d.school_id, student_id=s.id, section_id=s.section_id, date=at.date(), status=status,
                                       method="biometric", marked_at=at)
                db.add(rec)
                existing[(s.id, at.date())] = rec
            elif rec.status in ("absent", "leave") and rec.method != "manual":
                rec.status, rec.method, rec.marked_at = status, "biometric", at
    d.punches += stored
    await db.flush()
    return f"OK: {stored}"


async def poll(db: AsyncSession, serial: str) -> str | None:
    return "OK" if await _machine(db, serial) else None
