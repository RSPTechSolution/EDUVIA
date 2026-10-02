---
name: schoolerp-phase-02-academics
description: >
  Phase 2 of SchoolERP (Python + Flutter) — student management, academics
  (subjects, timetable, syllabus), homework, lesson planner, certificates
  (WeasyPrint PDF), and ID cards. Use when building student records,
  timetables, homework, or certificates in SchoolERP.
---
# Phase 2 — Academic Modules
## Python FastAPI · Flutter

## SQLAlchemy Models

```python
# api/app/models/academics.py
class Student(Base, TimestampMixin):
    __tablename__ = "students"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    admission_no: Mapped[str] = mapped_column(String(50))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    __table_args__ = (UniqueConstraint("school_id", "admission_no"),)

class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"))
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(20))
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # hex color for timetable

class Timetable(Base):
    __tablename__ = "timetables"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    day_of_week: Mapped[int] = mapped_column()  # 1=Mon...6=Sat
    period: Mapped[int] = mapped_column()
    start_time: Mapped[str] = mapped_column(String(5))  # "08:00"
    end_time: Mapped[str] = mapped_column(String(5))    # "08:45"
    __table_args__ = (UniqueConstraint("section_id", "day_of_week", "period"),)

class Homework(Base):
    __tablename__ = "homework"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attachments: Mapped[list] = mapped_column(ARRAY(String), default=[])
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class HomeworkSubmission(Base):
    __tablename__ = "homework_submissions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    homework_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("homework.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments: Mapped[list] = mapped_column(ARRAY(String), default=[])
    status: Mapped[str] = mapped_column(String(20), default="submitted")
    grade: Mapped[str | None] = mapped_column(String(10), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("homework_id", "student_id"),)
```

## Key API Routes

```python
# api/app/routers/students.py
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
```

## Bulk Import Service

```python
# api/app/services/student_service.py
import csv, io
from pydantic import ValidationError

async def bulk_import_csv(db: AsyncSession, school_id: uuid.UUID, content: bytes) -> dict:
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    created, errors = 0, []

    for i, row in enumerate(reader, start=2):  # row 1 = header
        try:
            validated = StudentCreate(**row)
            student = Student(**validated.model_dump(), school_id=school_id)
            db.add(student)
            created += 1
        except ValidationError as e:
            errors.append({"row": i, "errors": e.errors()})

    if created > 0:
        await db.flush()
    return {"created": created, "errors": errors}
```

## Certificate PDF (WeasyPrint)

```python
# api/app/services/certificate_service.py
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

jinja_env = Environment(loader=FileSystemLoader("app/templates/certificates"))

async def generate_certificate_pdf(student: Student, certificate: Certificate) -> bytes:
    template = jinja_env.get_template(f"{certificate.type}.html")
    html_str = template.render(
        student=student,
        school=student.school,
        certificate=certificate,
        issue_date=date.today().strftime("%d %B %Y"),
    )
    return HTML(string=html_str, base_url="app/templates/certificates").write_pdf()
```

## Flutter — Students Feature

```dart
// lib/features/students/providers/students_provider.dart
@riverpod
class StudentsNotifier extends _$StudentsNotifier {
  @override
  Future<PaginatedStudents> build() => _fetchStudents();

  Future<PaginatedStudents> _fetchStudents({int page = 1, String search = ''}) async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/v1/students', params: {'page': page, 'search': search});
    return PaginatedStudents.fromJson(res['data']);
  }

  Future<void> search(String query) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetchStudents(search: query));
  }
}

// lib/features/students/screens/students_list_screen.dart
// Uses: SearchBar, FilterSheet, DataTable/ListView with StudentCard
// Pull-to-refresh → ref.refresh(studentsNotifierProvider)
// FAB → show CreateStudentSheet (form with TextFormFields)
```

## Testing — Phase 2

```python
# api/tests/integration/test_students.py
@pytest.mark.asyncio
async def test_bulk_import_csv(auth_client):
    csv_content = b"first_name,last_name,admission_no,class_id,section_id\nJohn,Doe,S001,{class_id},{section_id}"
    res = await auth_client.post("/api/v1/students/bulk-import",
        files={"file": ("students.csv", csv_content, "text/csv")})
    assert res.status_code == 200
    assert res.json()["data"]["created"] == 1

@pytest.mark.asyncio
async def test_timetable_clash_detected(auth_client):
    # Assign same teacher to two slots at same time
    slots = [
        {"day_of_week": 1, "period": 1, "subject_id": "...", "teacher_id": "t1"},
        {"day_of_week": 1, "period": 1, "subject_id": "...", "teacher_id": "t1"},  # clash!
    ]
    res = await auth_client.put(f"/api/v1/academics/timetable/{section_id}", json={"slots": slots})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "TEACHER_CLASH"
```

## Antigravity Prompt for Phase 2

```
@file skills/master-plan/SKILL.md
@file skills/phase-02-academics/SKILL.md

Build Phase 2:
1. Add all SQLAlchemy models + Alembic migration
2. FastAPI students router: CRUD, bulk CSV import (Pydantic validation per row),
   Excel export (openpyxl), batch promotion
3. FastAPI academics router: subjects, timetable with teacher clash detection,
   syllabus topic tracker with completion %
4. FastAPI homework router: create/list/submit/grade flow
5. Certificate PDF via WeasyPrint + Jinja2 HTML templates
6. Flutter students feature: list with search/filter (Riverpod), student profile
   screen with tabs (academics, fees summary, attendance summary)
7. Flutter timetable screen: weekly grid widget, period-wise slots, color by subject
8. Flutter homework screen: list with status badges, submit dialog with file picker
9. Write all tests: pytest for API, flutter_test for widgets/providers
```
