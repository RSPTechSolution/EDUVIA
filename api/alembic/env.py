import asyncio
from logging.config import fileConfig
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import settings
from app.core.database import Base
from app.models.school import School, SchoolModule, AcademicYear
from app.models.user import User, UserSession
from app.models.audit_log import AuditLog
from app.models.academics import Class, Section, Student, Subject, Timetable, Homework, HomeworkSubmission
from app.models.attendance import AttendanceRecord, BiometricDevice, BiometricPunch, QrScanLog
from app.models.finance import FeeCategory, FeeStructure, FeeInvoice, FeePayment, Expense
from app.models.exams import Question, OnlineExam, ExamAttempt
from app.models.live_class import LiveClass
from app.models.communication import ChatThread, ChatMessage, Survey, SurveyResponse
from app.models.transport import Driver, Route, RouteStop, Trip, TripGpsLog, TripBoarding, Sos
from app.models.hr import Staff, LeaveType, LeaveApplication, SalaryStructure, PayrollRun, SalarySlip
from app.models.library import Book, BookCopy, BookIssue
from app.models.hostel import HostelRoom, HostelAllocation
from app.models.inventory import InventoryItem, Asset
from app.models.security import GatePass, GateLog, CctvCamera, CctvConsent, ComplianceDocument, CampusWorker
from app.models.saas import Plan, SchoolSubscription, SchoolBranding, BackupConfig, DomainMapping
config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
