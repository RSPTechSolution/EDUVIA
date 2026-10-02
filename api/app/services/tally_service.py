import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.finance import FeePayment
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

async def get_payments_in_range(db: AsyncSession, school_id: uuid.UUID, from_date: date, to_date: date):
    stmt = select(FeePayment).where(
        FeePayment.school_id == school_id,
        FeePayment.paid_at >= from_date,
        FeePayment.paid_at <= to_date
    )
    result = await db.execute(stmt)
    return result.scalars().all()

async def export_tally_xml(db: AsyncSession, school_id: uuid.UUID, from_date: date, to_date: date) -> bytes:
    payments = await get_payments_in_range(db, school_id, from_date, to_date)

    envelope = Element("ENVELOPE")
    header = SubElement(envelope, "HEADER")
    SubElement(header, "TALLYREQUEST").text = "Import Data"

    body = SubElement(envelope, "BODY")
    import_data = SubElement(body, "IMPORTDATA")
    request_desc = SubElement(import_data, "REQUESTDESC")
    SubElement(request_desc, "REPORTNAME").text = "Vouchers"

    request_data = SubElement(import_data, "REQUESTDATA")
    for p in payments:
        voucher = SubElement(request_data, "TALLYMESSAGE", xmlns_udf="TallyUDF")
        v = SubElement(voucher, "VOUCHER", VCHTYPE="Receipt", ACTION="Create")
        SubElement(v, "DATE").text = p.paid_at.strftime("%Y%m%d")
        SubElement(v, "NARRATION").text = f"Fee receipt {p.receipt_no}"
        SubElement(v, "VOUCHERTYPENAME").text = "Receipt"
        SubElement(v, "VOUCHERNUMBER").text = p.receipt_no
        # Ledger entries
        all_ledgers = SubElement(v, "ALLLEDGERENTRIES.LIST")
        ledger = SubElement(all_ledgers, "ALLLEDGERENTRIES")
        SubElement(ledger, "LEDGERNAME").text = "School Fee Income"
        SubElement(ledger, "AMOUNT").text = str(-p.amount)

    xml_str = minidom.parseString(tostring(envelope)).toprettyxml(indent="  ")
    return xml_str.encode("utf-8")
