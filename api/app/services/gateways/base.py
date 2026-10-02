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
