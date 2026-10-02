import csv, io, uuid
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.models.academics import Student
from app.schemas.academics import StudentCreate, PromoteRequest
import openpyxl

async def list_students(db: AsyncSession, school_id: uuid.UUID, page: int, page_size: int, search: str, class_id: str, section_id: str):
    from app.models.academics import Section, Class
    stmt = select(Student, Section.name.label("section_name"), Class.name.label("class_name"))\
        .join(Section, Student.section_id == Section.id)\
        .join(Class, Section.class_id == Class.id)\
        .where(Student.school_id == school_id)
    if search:
        stmt = stmt.where(Student.first_name.ilike(f"%{search}%") | Student.last_name.ilike(f"%{search}%") | Student.admission_no.ilike(f"%{search}%"))
    if section_id:
        stmt = stmt.where(Student.section_id == uuid.UUID(section_id))
    
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = await db.execute(stmt)
    
    items = []
    for row in rows:
        student, sec_name, cls_name = row
        s_dict = {
            "id": student.id, "school_id": student.school_id, "section_id": student.section_id,
            "admission_no": student.admission_no, "first_name": student.first_name,
            "last_name": student.last_name, "status": student.status, "photo": student.photo,
            "gender": student.gender, "parent_phone": student.phone,
            "class_name": cls_name, "section_name": sec_name
        }
        items.append(s_dict)
    
    return {"items": items, "total": total}

async def create_student(db: AsyncSession, school_id: uuid.UUID, data: StudentCreate):
    student = Student(**data.model_dump(), school_id=school_id)
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student

async def bulk_import_csv(db: AsyncSession, school_id: uuid.UUID, content: bytes) -> dict:
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    created, errors = 0, []

    for i, row in enumerate(reader, start=2):
        try:
            validated = StudentCreate(**row)
            student = Student(**validated.model_dump(), school_id=school_id)
            db.add(student)
            created += 1
        except Exception as e:
            errors.append({"row": i, "errors": str(e)})

    if created > 0:
        await db.commit()
    return {"created": created, "errors": errors}

async def export_to_excel(db: AsyncSession, school_id: uuid.UUID) -> bytes:
    students = await db.scalars(select(Student).where(Student.school_id == school_id))
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["ID", "Admission No", "First Name", "Last Name", "Email", "Section ID"])
    for s in students:
        ws.append([str(s.id), s.admission_no, s.first_name, s.last_name, s.email, str(s.section_id)])
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()

async def promote_batch(db: AsyncSession, school_id: uuid.UUID, body: PromoteRequest):
    await db.execute(
        update(Student)
        .where(Student.school_id == school_id, Student.id.in_(body.student_ids))
        .values(section_id=body.to_section_id)
    )
    await db.commit()
    return {"message": f"{len(body.student_ids)} students promoted."}
