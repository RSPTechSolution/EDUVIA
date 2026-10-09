import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints, model_validator

Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class ExamIn(BaseModel):
    name: Name
    kind: Literal["unit_test", "term", "final"] = "term"
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def _dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("The exam can't end before it starts")
        return self


class ExamUpdate(BaseModel):
    name: Name | None = None
    kind: Literal["unit_test", "term", "final"] | None = None
    start_date: date | None = None
    end_date: date | None = None


class ExamOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: str
    academic_year: str
    start_date: date | None
    end_date: date | None
    published_at: datetime | None
    status: Literal["draft", "upcoming", "ongoing", "marks_entry", "published"]
    classes: int
    papers: int
    marks_entered: int
    marks_expected: int


class PaperIn(BaseModel):
    subject_id: uuid.UUID
    exam_date: date | None = None
    max_marks: Annotated[Decimal, Field(gt=0, le=1000)]
    pass_marks: Annotated[Decimal, Field(ge=0, le=1000)]

    @model_validator(mode="after")
    def _pass(self):
        if self.pass_marks > self.max_marks:
            raise ValueError("Pass marks can't be more than maximum marks")
        return self


class ClassPapersSet(BaseModel):
    class_id: uuid.UUID
    papers: list[PaperIn] = Field(max_length=30)


class FromTimetable(BaseModel):
    class_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)
    max_marks: Annotated[Decimal, Field(gt=0, le=1000)] = Decimal(100)
    pass_marks: Annotated[Decimal, Field(ge=0, le=1000)] = Decimal(33)
    skip_subject_ids: list[uuid.UUID] = Field(default_factory=list)


class PaperOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    subject_id: uuid.UUID
    subject_name: str
    subject_color: str
    exam_date: date | None
    max_marks: Num
    pass_marks: Num
    marks_entered: int
    students: int


class ClassPapers(BaseModel):
    class_id: uuid.UUID
    class_name: str
    papers: list[PaperOut]


class ExamDetail(ExamOut):
    classes_detail: list[ClassPapers]


class MarksSheetRef(BaseModel):
    paper_id: uuid.UUID
    section_id: uuid.UUID
    section_label: str
    subject_name: str
    subject_color: str
    exam_date: date | None
    max_marks: Num
    entered: int
    students: int


class MarkRow(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    marks: Num | None
    absent: bool


class MarksSheet(BaseModel):
    paper_id: uuid.UUID
    section_id: uuid.UUID
    exam_name: str
    section_label: str
    subject_name: str
    max_marks: Num
    pass_marks: Num
    editable: bool
    locked_reason: str | None
    rows: list[MarkRow]


class MarkIn(BaseModel):
    student_id: uuid.UUID
    marks: Annotated[Decimal, Field(ge=0, max_digits=6, decimal_places=2)] | None = None
    absent: bool = False


class MarksSave(BaseModel):
    entries: list[MarkIn] = Field(min_length=1, max_length=200)


class SubjectResult(BaseModel):
    subject_name: str
    max_marks: Num
    pass_marks: Num
    marks: Num | None
    absent: bool
    grade: str | None
    passed: bool | None


class StudentResult(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_no: int | None
    subjects: list[SubjectResult]
    total: Num
    max_total: Num
    percent: float | None
    grade: str | None
    passed: bool
    rank: int | None
    remark: str | None


class SubjectStat(BaseModel):
    subject_name: str
    average: float | None
    highest: Num | None
    pass_rate: float | None


class SectionResults(BaseModel):
    exam_id: uuid.UUID
    exam_name: str
    section_label: str
    published: bool
    students: list[StudentResult]
    subjects: list[SubjectStat]
    average_percent: float | None
    pass_rate: float | None


class RemarkSet(BaseModel):
    remark: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class ReportCard(BaseModel):
    exam_id: uuid.UUID
    exam_name: str
    academic_year: str
    school_name: str
    school_address: str | None
    student_name: str
    admission_no: str
    class_section: str
    roll_no: int | None
    date_of_birth: date
    class_teacher: str | None
    result: StudentResult
    class_size: int
    attendance_percent: float | None
    published: bool
    co_scholastic: list[dict] = []  # [{area, grade}]


class MyExam(BaseModel):
    exam_id: uuid.UUID
    exam_name: str
    kind: str
    published_at: datetime
    percent: float | None
    grade: str | None
    rank: int | None
    class_size: int
    passed: bool


class ChildResults(BaseModel):
    student_id: uuid.UUID
    name: str
    class_section: str
    exams: list[MyExam]
    upcoming: list[PaperOut]  # date sheet of exams not yet published
