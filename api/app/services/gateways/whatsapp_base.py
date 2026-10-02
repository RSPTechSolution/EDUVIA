from abc import ABC, abstractmethod

class WhatsAppResult:
    def __init__(self, ref: str, status: str):
        self.ref = ref
        self.status = status

class WhatsAppGateway(ABC):
    @abstractmethod
    async def send_message(self, to: str, text: str) -> WhatsAppResult:
        pass

class WaBlasGateway(WhatsAppGateway):
    async def send_message(self, to: str, text: str) -> WhatsAppResult:
        return WhatsAppResult("mock_wablas", "sent")

class UltramsgGateway(WhatsAppGateway):
    async def send_message(self, to: str, text: str) -> WhatsAppResult:
        return WhatsAppResult("mock_ultramsg", "sent")

class MaytapiGateway(WhatsAppGateway):
    async def send_message(self, to: str, text: str) -> WhatsAppResult:
        return WhatsAppResult("mock_maytapi", "sent")
