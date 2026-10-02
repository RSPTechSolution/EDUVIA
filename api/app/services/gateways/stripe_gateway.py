from app.services.gateways.base import PaymentGateway, OrderResult, PaymentVerification

class StripeGateway(PaymentGateway):
    def __init__(self, secret_key: str, webhook_secret: str):
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret

    async def create_order(self, amount_paise: int, invoice_id: str, currency: str = "inr") -> OrderResult:
        # Mocking stripe intent
        intent_id = f"pi_{invoice_id[:8]}"
        return OrderResult(order_id=intent_id, gateway_data={"client_secret": "test_secret"})

    async def verify_payment(self, payment_id: str, order_id: str, signature: str) -> PaymentVerification:
        return PaymentVerification(transaction_id=payment_id, status="succeeded", amount=0)

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        # Simplified for simulation
        return True
