from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class SmsResult:
    gateway_ref: str
    status: str  # sent|failed

class SmsGateway(ABC):
    @abstractmethod
    async def send(self, to: str, body: str) -> SmsResult:
        pass
