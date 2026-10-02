from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class Meta(BaseModel):
    total: int
    page: int
    page_size: int

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    meta: Optional[Meta] = None

class ApiError(BaseModel):
    success: bool = False
    error: dict
