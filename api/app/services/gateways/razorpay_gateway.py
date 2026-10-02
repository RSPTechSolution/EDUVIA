import hmac
import hashlib
from app.services.gateways.base import PaymentGateway, OrderResult, PaymentVerification

class RazorpayGateway(PaymentGateway):
    def __init__(self, key_id: str, key_secret: str):
        # Using a dummy client for simulation in tests/local
        self.key_id = key_id
        self.key_secret = key_secret

    async def create_order(self, amount_paise: int, invoice_id: str, currency: str = "INR") -> OrderResult:
        # Mocking razorpay response
        order_id = f"order_{invoice_id[:8]}"
        return OrderResult(order_id=order_id, gateway_data={"key_id": self.key_id, "order": {"id": order_id, "amount": amount_paise}})

    async def verify_payment(self, payment_id: str, order_id: str, signature: str) -> PaymentVerification:
        return PaymentVerification(transaction_id=payment_id, status="captured", amount=0)

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        expected = hmac.new(self.key_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
