import httpx
from app.services.gateways.sms_base import SmsGateway, SmsResult

class Msg91Gateway(SmsGateway):
    def __init__(self, auth_key: str, template_id: str, sender_id: str):
        self.auth_key = auth_key
        self.template_id = template_id
        self.sender_id = sender_id

    async def send(self, to: str, body: str) -> SmsResult:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.msg91.com/api/v5/flow/",
                json={"template_id": self.template_id,
                      "recipients": [{"mobiles": to, "var": body}]},
                headers={"authkey": self.auth_key, "Content-Type": "application/json"},
            )
            data = res.json()
            return SmsResult(gateway_ref=data.get("request_id", ""), status="sent" if res.is_success else "failed")

class Fast2SmsGateway(SmsGateway):
    def __init__(self, **kwargs): pass
    async def send(self, to: str, body: str) -> SmsResult:
        return SmsResult(gateway_ref="mock_f2s", status="sent")

class TwilioGateway(SmsGateway):
    def __init__(self, **kwargs): pass
    async def send(self, to: str, body: str) -> SmsResult:
        return SmsResult(gateway_ref="mock_twilio", status="sent")

class TextlocalGateway(SmsGateway):
    def __init__(self, **kwargs): pass
    async def send(self, to: str, body: str) -> SmsResult:
        return SmsResult(gateway_ref="mock_textlocal", status="sent")

def get_sms_gateway(school_settings: dict) -> SmsGateway:
    gw = school_settings.get("sms_gateway", "msg91")
    config = school_settings.get("sms_config", {"auth_key": "x", "template_id": "y", "sender_id": "z"})
    return {
        "msg91": lambda: Msg91Gateway(config["auth_key"], config["template_id"], config["sender_id"]),
        "fast2sms": lambda: Fast2SmsGateway(**config),
        "twilio": lambda: TwilioGateway(**config),
        "textlocal": lambda: TextlocalGateway(**config),
    }[gw]()
