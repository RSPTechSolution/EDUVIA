import httpx
from datetime import datetime
from decimal import Decimal

async def lookup_isbn(isbn: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=details")
        if not res.is_success:
            return None
        data = res.json()
        key = f"ISBN:{isbn}"
        if key not in data:
            return None
        details = data[key].get("details", {})
        return {
            "title": details.get("title", ""),
            "authors": [a.get("name", "") for a in details.get("authors", [])],
            "publisher": details.get("publishers", [{}])[0].get("name", "") if details.get("publishers") else "",
            "cover_url": f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg",
        }

def calculate_fine(due_date: datetime, returned_at: datetime, rate_per_day: Decimal) -> Decimal:
    if returned_at <= due_date:
        return Decimal("0")
    overdue_days = (returned_at.date() - due_date.date()).days
    return Decimal(overdue_days) * rate_per_day
