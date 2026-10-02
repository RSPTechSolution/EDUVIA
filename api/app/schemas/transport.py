import uuid
from decimal import Decimal
from pydantic import BaseModel
from typing import List, Optional

class GpsPing(BaseModel):
    lat: Decimal
    lng: Decimal
    speed: Optional[Decimal] = None

class GpsBatch(BaseModel):
    pings: List[GpsPing]

class SosRequest(BaseModel):
    trip_id: uuid.UUID
    lat: Decimal
    lng: Decimal
