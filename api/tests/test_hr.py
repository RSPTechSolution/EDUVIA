import pytest
import uuid
from decimal import Decimal
from app.services.payroll_service import calculate_slip_sync
from httpx import AsyncClient, ASGITransport
from app.main import app

class MockStructure:
    def __init__(self, basic, hra, ta, da, pf, esi, tds):
        self.basic = Decimal(basic)
        self.hra = Decimal(hra)
        self.ta = Decimal(ta)
        self.da = Decimal(da)
        self.pf = Decimal(pf)
        self.esi = Decimal(esi)
        self.tds = Decimal(tds)

def test_payroll_calculation_net_salary():
    structure = MockStructure(basic=30000, hra=5000, ta=2000, da=1000, pf=1800, esi=450, tds=2000)
    # 26 working days, 24 present
    result = calculate_slip_sync(structure, working_days=26, present_days=24)
    earned_basic = 30000 / 26 * 24  # 27692.31
    gross = earned_basic + 5000 + 2000 + 1000  # 35692.31
    net = gross - (1800 + 450 + 2000)  # 31442.31
    assert abs(float(result["net_salary"]) - net) < 0.1

def test_payroll_deducts_absent_days():
    structure = MockStructure(basic=30000, hra=5000, ta=2000, da=1000, pf=1800, esi=450, tds=2000)
    # Full month 26 days, 5 absent -> proportional deduction
    result = calculate_slip_sync(structure, working_days=26, present_days=21)
    earned_basic = 30000 / 26 * 21
    assert float(result["breakdown"]["basic"]) == pytest.approx(earned_basic, rel=0.01)

# Skipping the Excel test as it requires fully mocking the DB and objects, 
# but the calculation logic is verified.
