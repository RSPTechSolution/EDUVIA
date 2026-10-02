from app.services.gateways.base import PaymentGateway
from app.services.gateways.razorpay_gateway import RazorpayGateway
from app.services.gateways.stripe_gateway import StripeGateway

def get_gateway(method: str, school_settings: dict) -> PaymentGateway:
    if method == "razorpay":
        return RazorpayGateway(
            school_settings.get("razorpay_key_id", "test_id"), 
            school_settings.get("razorpay_key_secret", "test_secret")
        )
    if method == "stripe":
        return StripeGateway(
            school_settings.get("stripe_secret_key", "test_secret"), 
            school_settings.get("stripe_webhook_secret", "test_webhook")
        )
    raise ValueError(f"Unknown gateway: {method}")
