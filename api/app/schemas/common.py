from datetime import datetime
import uuid
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    meta: PageMeta | None = None


class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(25, ge=1, le=200)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def ok(data=None, meta: PageMeta | None = None) -> dict:
    return {"success": True, "data": data, "meta": meta}


class Message(BaseModel):
    message: str


class FileOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size: int
    label: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
