"""Uploaded files: saved on disk, described in the `files` table, guarded by per-purpose rules.

Each purpose registers who may upload and who may read. Modules add their own purposes with
`register_purpose`, so the rules live next to the feature they protect.
"""
import mimetypes
import os
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, Forbidden, NotFound
from app.core.permissions import STAFF_ROLES, has_permission
from app.models import StoredFile, User

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv",
}
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

Check = Callable[[AsyncSession, User, uuid.UUID | None], Awaitable[bool]]


@dataclass
class Purpose:
    can_upload: Check
    can_read: Check
    images_only: bool = False
    single: bool = False  # e.g. a photo: uploading replaces the previous one
    # Called with the new file id after an upload, or None after a delete (e.g. to set student.photo_file_id).
    on_change: Callable[[AsyncSession, User, uuid.UUID | None, uuid.UUID | None], Awaitable[None]] | None = None


_PURPOSES: dict[str, Purpose] = {}


def register_purpose(name: str, purpose: Purpose) -> None:
    _PURPOSES[name] = purpose


def _root() -> Path:
    return Path(settings.STORAGE_DIR).resolve()


def _path(key: str) -> Path:
    p = (_root() / key).resolve()
    if _root() not in p.parents:
        raise NotFound("File not found")  # never follow a key outside the storage folder
    return p


async def save(db: AsyncSession, user: User, *, purpose: str, owner_id: uuid.UUID | None, filename: str,
               content_type: str | None, data: bytes, label: str | None = None) -> StoredFile:
    rules = _PURPOSES.get(purpose)
    if not rules:
        raise AppError("Unknown upload type", code="BAD_PURPOSE", status_code=422)
    if not await rules.can_upload(db, user, owner_id):
        raise Forbidden("You can't upload this file", code="UPLOAD_FORBIDDEN")
    content_type = (content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream").split(";")[0].lower()
    if content_type not in (IMAGE_TYPES if rules.images_only else ALLOWED_TYPES):
        raise AppError("Choose an image (JPG, PNG or WebP)" if rules.images_only else
                       "That file type isn't allowed. Use an image, PDF, Word, Excel, PowerPoint or text file.",
                       code="FILE_TYPE", status_code=422)
    if not data:
        raise AppError("The file is empty", code="FILE_EMPTY", status_code=422)
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise AppError(f"Files can be at most {settings.MAX_UPLOAD_MB} MB", code="FILE_TOO_BIG", status_code=413)

    if rules.single and owner_id:
        for old in (await db.scalars(select(StoredFile).where(StoredFile.purpose == purpose, StoredFile.owner_id == owner_id))).all():
            await delete_file(db, old)

    ext = Path(filename).suffix.lower()[:10] or (mimetypes.guess_extension(content_type) or "")
    key = f"{user.school_id or 'platform'}/{purpose}/{uuid.uuid4().hex}{ext}"
    path = _path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    f = StoredFile(school_id=user.school_id, purpose=purpose, owner_id=owner_id, filename=Path(filename).name[:255] or "file",
                   content_type=content_type, size=len(data), storage_key=key, label=label, uploaded_by=user.id)
    db.add(f)
    await db.flush()
    if rules.on_change:
        await rules.on_change(db, user, owner_id, f.id)
    return f


async def get_readable(db: AsyncSession, user: User, file_id: uuid.UUID) -> StoredFile:
    f = await db.scalar(select(StoredFile).where(StoredFile.id == file_id))
    if not f or (f.school_id and f.school_id != user.school_id):
        raise NotFound("File not found")
    rules = _PURPOSES.get(f.purpose)
    if f.uploaded_by != user.id and not (rules and await rules.can_read(db, user, f.owner_id)):
        raise NotFound("File not found")
    return f


def read_bytes(f: StoredFile) -> bytes:
    p = _path(f.storage_key)
    if not p.exists():
        raise NotFound("The file is missing from storage")
    return p.read_bytes()


async def delete_file(db: AsyncSession, f: StoredFile) -> None:
    try:
        os.remove(_path(f.storage_key))
    except (FileNotFoundError, NotFound):
        pass
    await db.delete(f)


async def remove(db: AsyncSession, user: User, f: StoredFile) -> None:
    """Delete a file the user asked to remove (checks rights, then tells the owner it is gone)."""
    if not await can_delete(db, user, f):
        raise Forbidden("You can't remove this file", code="DELETE_FORBIDDEN")
    rules = _PURPOSES.get(f.purpose)
    owner_id = f.owner_id
    await delete_file(db, f)
    await db.flush()
    if rules and rules.on_change:
        await rules.on_change(db, user, owner_id, None)


async def can_delete(db: AsyncSession, user: User, f: StoredFile) -> bool:
    rules = _PURPOSES.get(f.purpose)
    return f.uploaded_by == user.id or bool(rules and await rules.can_upload(db, user, f.owner_id))


async def list_for(db: AsyncSession, user: User, purpose: str, owner_id: uuid.UUID) -> list[StoredFile]:
    rules = _PURPOSES.get(purpose)
    if not rules or not await rules.can_read(db, user, owner_id):
        raise NotFound("Not found")
    return list((await db.scalars(select(StoredFile).where(StoredFile.school_id == user.school_id, StoredFile.purpose == purpose,
                                                           StoredFile.owner_id == owner_id).order_by(StoredFile.created_at))).all())


# ---- built-in purposes ------------------------------------------------------------------------

async def _is_staff(db, user, owner_id) -> bool:
    return user.role in STAFF_ROLES


async def _anyone(db, user, owner_id) -> bool:
    return True


async def _self_or_users_manager(db, user, owner_id) -> bool:
    return owner_id == user.id or has_permission(user.role, "users.manage")


async def _school_manager(db, user, owner_id) -> bool:
    return has_permission(user.role, "school.manage")


async def _set_user_photo(db, user, owner_id, file_id) -> None:
    from sqlalchemy import update
    await db.execute(update(User).where(User.id == owner_id, User.school_id == user.school_id).values(photo_file_id=file_id))


async def _set_school_logo(db, user, owner_id, file_id) -> None:
    from app.models import School
    school = await db.get(School, user.school_id)
    if school:
        school.logo_url = f"{settings.API_PUBLIC_URL.rstrip('/')}/api/v1/files/public/{file_id}" if file_id else None


register_purpose("user_photo", Purpose(can_upload=_self_or_users_manager, can_read=_anyone, images_only=True, single=True,
                                       on_change=_set_user_photo))
register_purpose("school_logo", Purpose(can_upload=_school_manager, can_read=_anyone, images_only=True, single=True,
                                        on_change=_set_school_logo))
PUBLIC_PURPOSES = {"school_logo"}  # served without signing in (the public website shows the logo)
