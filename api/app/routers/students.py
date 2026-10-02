from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.base import ApiResponse
from app.schemas.academics import PaginatedStudents, StudentCreate, StudentOut, PromoteRequest
from app.services import student_service
from app.core.permissions import require_permission

router = APIRouter()

@router.get("/", response_model=ApiResponse[PaginatedStudents])
async def list_students(
    page: int = 1, page_size: int = 25, search: str = "", class_id: str = "", section_id: str = "",
    db: AsyncSession = Depends(get_db), current_user=Depends(require_permission("students.view"))
):
    return ApiResponse(data=await student_service.list_students(db, current_user.school_id, page, page_size, search, class_id, section_id))

@router.post("/", response_model=ApiResponse[StudentOut])
async def create_student(body: StudentCreate, db=Depends(get_db), user=Depends(require_permission("students.create"))):
    return ApiResponse(data=await student_service.create_student(db, user.school_id, body))

@router.get("/{student_id}")
async def get_student(student_id: str):
    mock_student = {
        "id": student_id, "first_name": 'John', "last_name": 'Doe', "photo": '', "admission_no": 'ADM001', 
        "class_name": 'Class 10', "section_name": 'A', "date_of_birth": '2005-04-12', 
        "gender": 'Male', "blood_group": 'O+', "phone": '1234567890', "email": 'john@example.com', 
        "admission_date": '2015-06-01', "status": 'active'
    }
    return {"success": True, "data": mock_student}

@router.post("/bulk-import")
async def bulk_import(file: UploadFile = File(...), db=Depends(get_db), user=Depends(require_permission("students.create"))):
    content = await file.read()
    result = await student_service.bulk_import_csv(db, user.school_id, content)
    return ApiResponse(data=result)

@router.get("/export")
async def export_students(db=Depends(get_db), user=Depends(require_permission("students.view"))):
    xlsx_bytes = await student_service.export_to_excel(db, user.school_id)
    return Response(content=xlsx_bytes, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=students.xlsx"})

@router.post("/promote")
async def promote_students(body: PromoteRequest, db=Depends(get_db), user=Depends(require_permission("students.edit"))):
    return ApiResponse(data=await student_service.promote_batch(db, user.school_id, body))
