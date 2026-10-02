from fastapi import BackgroundTasks

class EmailService:
    def __init__(self):
        # In a real app, this would use fastapi-mail
        # e.g., conf = ConnectionConfig(...)
        pass

    async def send_email(self, to: str, subject: str, template_name: str, context: dict):
        # Render jinja2 template and send email
        print(f"Sending email to {to}: {subject} using template {template_name}")

email_service = EmailService()

def send_fee_reminder(to: str, amount: str):
    import asyncio
    asyncio.run(email_service.send_email(to, "Fee Reminder", "fee_reminder.html", {"amount": amount}))

def send_welcome_email(to: str, name: str):
    import asyncio
    asyncio.run(email_service.send_email(to, "Welcome to SchoolERP", "welcome.html", {"name": name}))
