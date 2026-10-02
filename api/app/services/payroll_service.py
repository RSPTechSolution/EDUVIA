import uuid
from calendar import monthrange
from decimal import Decimal

# Sync version for testing
def calculate_slip_sync(structure, working_days: int, present_days: int, paid_leave_days: int = 0) -> dict:
    total_paid_days = present_days + paid_leave_days
    absent_days = working_days - total_paid_days

    daily_rate = structure.basic / Decimal(working_days)
    earned_basic = daily_rate * Decimal(total_paid_days)
    gross = earned_basic + structure.hra + structure.ta + structure.da
    deductions = structure.pf + structure.esi + structure.tds
    net = gross - deductions

    return {
        "gross_salary": round(gross, 2), "deductions": round(deductions, 2), "net_salary": round(net, 2),
        "present_days": present_days, "absent_days": absent_days, "leave_days": paid_leave_days,
        "breakdown": {
            "basic": float(earned_basic), "hra": float(structure.hra), "ta": float(structure.ta),
            "da": float(structure.da), "pf": float(structure.pf), "esi": float(structure.esi),
            "tds": float(structure.tds),
        },
    }

async def calculate_slip(db, staff_id: uuid.UUID, month: int, year: int) -> dict:
    # Mocks for actual db calls for demonstration
    pass
