---
name: schoolerp-master-plan
description: >
  Master orchestrator skill for building SchoolERP — a full-featured,
  production-ready, multi-tenant school management SaaS. Backend in Python
  (FastAPI), web frontend in Next.js 15, mobile in Flutter 3.x.
  Use this skill whenever the user asks about the overall architecture,
  which phase to work on, tech stack decisions, or how the system fits together.
  Also triggers when the user says "start SchoolERP", "next phase", "build ERP",
  or references the school management system project broadly.
---

# SchoolERP Master Plan
## Python + FastAPI · Next.js 15 · Flutter 3.x

## What We Are Building

A **production-ready, multi-tenant School Management ERP** equivalent to
Multi School ERP (multischoolerp.com) — 38 modules, 6 apps, modern UI/UX.

**Backend: Python + FastAPI**
**Web Dashboard: Next.js 15**
**Mobile Apps: Flutter 3.x (iOS + Android)**

---

## Tech Stack

| Layer | Technology | Version | Why |
|---|---|---|---|
| Backend API | **FastAPI** | 0.115+ | Async Python, auto OpenAPI docs, fastest Python framework |
| ORM | **SQLAlchemy 2.0 + Alembic** | 2.0 / 1.13 | Async ORM, migrations, type-safe |
| Data Validation | **Pydantic v2** | 2.x | Schema validation, serialization, settings |
| Database | **PostgreSQL 16** | 16 | JSONB, RLS, multi-tenant isolation |
| Async DB Driver | **asyncpg** | 0.29 | Fastest async PostgreSQL driver for Python |
| Cache / Queue | **Redis 7 + Celery 5** | 7 / 5.4 | Background jobs, scheduled tasks, caching |
| Task Broker | **Redis** (Celery broker) | 7 | Same Redis instance, separate DB index |
| Auth | **python-jose + passlib** | latest | JWT tokens, bcrypt hashing |
| Search | **MeiliSearch** | 1.8 | Full-text search for students, staff, books |
| File Storage | **MinIO (boto3/aioboto3)** | latest | S3-compatible, self-hosted |
| Web Frontend | **Next.js 15** | 15 | App Router, RSC, TypeScript |
| UI Components | **shadcn/ui + Tailwind CSS v4** | latest | Accessible, composable, modern |
| Charts | **Recharts** | 2.x | Dashboard analytics |
| Mobile | **Flutter 3.x** | 3.24+ | iOS + Android, single codebase, Dart |
| Mobile State | **Riverpod 2** | 2.x | Reactive, testable state management |
| Mobile HTTP | **Dio** | 5.x | HTTP client with interceptors |
| Mobile Navigation | **go_router** | 14.x | Declarative routing, deep links |
| Mobile Storage | **flutter_secure_storage** | 9.x | Secure token storage |
| Real-time | **FastAPI WebSockets + python-socketio** | latest | Chat, GPS feed, live dashboard |
| PDF | **WeasyPrint + Jinja2** | latest | Server-side PDF from HTML templates |
| Email | **FastAPI-Mail + Jinja2** | latest | Async email with HTML templates |
| SMS/WhatsApp | **Pluggable adapter classes** | — | 32+ SMS, 7 WhatsApp |
| AI | **LangChain + OpenAI / Google Gemini** | latest | AI assistant, safe query templates |
| Maps (Mobile) | **flutter_map + OpenStreetMap** | 7.x | Free GPS maps, no billing |
| Testing (API) | **pytest + pytest-asyncio + httpx** | latest | Async API tests |
| Testing (Web) | **Playwright** | 1.4+ | E2E browser tests |
| Testing (Mobile) | **flutter_test + integration_test** | SDK | Unit + widget + integration tests |
| Containerization | **Docker + Docker Compose** | 26 | Dev/prod parity |
| CI/CD | **GitHub Actions** | — | Auto test + deploy |
| Reverse Proxy | **Caddy 2** | 2 | Auto HTTPS, simple config |

---

## Repository Structure

```
schoolerp/
├── api/                        ← Python FastAPI backend
│   ├── app/
│   │   ├── main.py             ← FastAPI app entry, router registration
│   │   ├── core/
│   │   │   ├── config.py       ← Pydantic Settings (env vars)
│   │   │   ├── database.py     ← SQLAlchemy async engine + session
│   │   │   ├── security.py     ← JWT, password hashing
│   │   │   ├── redis.py        ← Redis client
│   │   │   └── dependencies.py ← FastAPI Depends() functions
│   │   ├── models/             ← SQLAlchemy ORM models (one file per domain)
│   │   ├── schemas/            ← Pydantic schemas (request/response)
│   │   ├── routers/            ← FastAPI routers (one file per module)
│   │   ├── services/           ← Business logic (one file per module)
│   │   ├── tasks/              ← Celery tasks
│   │   ├── templates/          ← Jinja2 HTML templates (for PDF/email)
│   │   └── utils/              ← Helpers: date, currency, file, pdf
│   ├── alembic/                ← DB migrations
│   ├── tests/                  ← pytest test suite
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
│
├── web/                        ← Next.js 15 web dashboard
│   ├── src/
│   │   ├── app/                ← App Router pages
│   │   ├── components/         ← shadcn/ui + custom components
│   │   ├── lib/                ← API client, auth helpers
│   │   └── hooks/              ← Custom React hooks
│   ├── package.json
│   └── Dockerfile
│
├── mobile/                     ← Flutter 3.x apps
│   ├── lib/
│   │   ├── main.dart           ← App entry, flavor detection
│   │   ├── core/
│   │   │   ├── api/            ← Dio API client + interceptors
│   │   │   ├── router/         ← go_router configuration
│   │   │   ├── theme/          ← ThemeData, colors, typography
│   │   │   └── utils/          ← formatters, validators
│   │   ├── features/           ← Feature-first structure
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── students/
│   │   │   ├── attendance/
│   │   │   ├── fees/
│   │   │   ├── exams/
│   │   │   ├── chat/
│   │   │   ├── transport/      ← Driver GPS app feature
│   │   │   └── ...
│   │   └── shared/             ← Widgets, models, providers
│   ├── test/
│   ├── integration_test/
│   ├── pubspec.yaml
│   └── Dockerfile
│
├── infra/
│   ├── compose/
│   │   ├── docker-compose.dev.yml
│   │   └── docker-compose.prod.yml
│   └── caddy/Caddyfile
│
└── skills/                     ← All SKILL.md files (this package)
```

---

## Multi-Tenancy Design

- Every SQLAlchemy model has a `school_id: UUID` column
- FastAPI dependency `get_current_school_id()` extracts from JWT
- SQLAlchemy session middleware auto-filters all queries via `school_id`
- PostgreSQL Row Level Security (RLS) as second enforcement layer
- Super Admin role bypasses RLS via `SET LOCAL row_security = OFF`

```python
# core/dependencies.py
async def get_db_session(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AsyncSession:
    async with AsyncSession(engine) as session:
        # Set school_id context for RLS
        await session.execute(
            text("SET LOCAL app.current_school_id = :sid"),
            {"sid": str(current_user.school_id)}
        )
        yield session
```

---

## API Response Shape (All Endpoints)

```python
# schemas/base.py
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class Meta(BaseModel):
    total: int
    page: int
    page_size: int

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    meta: Optional[Meta] = None

class ApiError(BaseModel):
    success: bool = False
    error: dict  # { code: str, message: str, details?: any }
```

---

## Flutter App Flavors

Single Flutter codebase, 3 flavors via `--dart-define`:

```
FLAVOR=parent   → Parent & Student App
FLAVOR=staff    → Staff & Admin App
FLAVOR=driver   → Driver GPS App
```

```dart
// lib/main.dart
void main() {
  const flavor = String.fromEnvironment('FLAVOR', defaultValue: 'parent');
  runApp(
    ProviderScope(
      child: SchoolERPApp(flavor: flavor),
    ),
  );
}
```

---

## Coding Standards

### Python / FastAPI
- All endpoints async (`async def`)
- Pydantic v2 for ALL request/response schemas — no raw dicts
- SQLAlchemy 2.0 style: `select(Model).where(...)` not `.query()`
- Services handle all business logic — routers are thin
- Custom exception classes → FastAPI exception handlers
- All file names: `snake_case.py`
- Docstrings on all service functions

### Flutter / Dart
- Riverpod 2 for all state (`AsyncNotifierProvider`, `StreamProvider`)
- Feature-first folder structure: `features/fee/screens/`, `features/fee/providers/`, `features/fee/widgets/`
- All API calls go through `ApiClient` (Dio wrapper in `core/api/`)
- No business logic in widgets — only in providers/notifiers
- `freezed` + `json_serializable` for all model classes
- All file names: `snake_case.dart`

### Testing
- Python: `pytest` + `pytest-asyncio` + `httpx.AsyncClient`
- Flutter: `flutter_test` for unit/widget, `integration_test` for E2E
- Minimum 80% coverage per module

---

## 13 Build Phases

| Phase | What Gets Built | Skill File |
|---|---|---|
| **01** | Repo setup, DB models, Auth, RBAC, Super Admin, Shell | `phase-01-foundation/SKILL.md` |
| **02** | Students, Academics, Timetable, Homework, Certificates | `phase-02-academics/SKILL.md` |
| **03** | Biometric ADMS, QR Attendance, Manual Attendance | `phase-03-attendance/SKILL.md` |
| **04** | Fee Structure, Collection, Gateways, Receipts, Accounts | `phase-04-finance/SKILL.md` |
| **05** | Offline Exams, Online CBT, Question Bank, Live Classes | `phase-05-exams/SKILL.md` |
| **06** | SMS/WhatsApp/Email, Chat (WebSocket), PTM, Surveys | `phase-06-communication/SKILL.md` |
| **07** | Transport GPS, Driver App, Live Ops Console | `phase-07-transport/SKILL.md` |
| **08** | HR, Leave Management, Payroll Automation | `phase-08-hr/SKILL.md` |
| **09** | Library, Hostel, Inventory, Assets | `phase-09-hostel-library/SKILL.md` |
| **10** | Gate Pass, CCTV Consent, Compliance, Campus Workers | `phase-10-security/SKILL.md` |
| **11** | AI Assistant (LangChain), Analytics, Report Builder | `phase-11-ai-analytics/SKILL.md` |
| **12** | Flutter Apps — Parent, Staff, Driver (all features) | `phase-12-mobile/SKILL.md` |
| **13** | SaaS Super Admin, Billing, White-label, Backup | `phase-13-saas-admin/SKILL.md` |

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://schoolerp:secret@localhost:5432/schoolerp

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# JWT
JWT_SECRET_KEY=<64-char-random>
JWT_REFRESH_SECRET_KEY=<64-char-random>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=schoolerp
MINIO_SECURE=false

# AI
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Search
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=schoolerp_meili_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# App
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8000
WEB_PORT=3000
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
DEBUG=true
```

---

## Antigravity IDE Usage

```
Session start for any phase:
  @file skills/master-plan/SKILL.md
  @file skills/phase-XX-name/SKILL.md
  "Build Phase XX exactly as described."

Antigravity will:
  - Create all Python files (models, schemas, routers, services, tests)
  - Create all Flutter files (models, providers, screens, widgets, tests)
  - Create all Next.js files (pages, components, hooks)
  - Run migrations: cd api && alembic upgrade head
  - Run seeds: cd api && python -m app.seed
  - Run tests: pytest tests/ -v
  - Run Flutter tests: flutter test
```

---

## Web App Build Phases (Build BEFORE Mobile Apps)

Build web phases first — they establish the design system, API integration
patterns, and UI components that the mobile apps reference.

| Phase | What Gets Built | Skill File |
|---|---|---|
| **WEB-01** | Design system, tokens, component library, Storybook | `phase-web-01-design-system/SKILL.md` |
| **WEB-02** | App shell, sidebar, header, command palette, auth | `phase-web-02-shell/SKILL.md` |
| **WEB-03** | Students module, academics, timetable builder | `phase-web-03-students-academics/SKILL.md` |
| **WEB-04** | Main dashboard, attendance marking, heatmap, biometric | `phase-web-04-attendance-dashboard/SKILL.md` |
| **WEB-05** | Finance dashboard, fee collection, analytics, defaulters | `phase-web-05-finance-dashboard/SKILL.md` |
| **WEB-06** | Exams builder, CBT item analysis, chat UI, surveys | `phase-web-06-exams-communication/SKILL.md` |
| **WEB-07** | Transport live map, HR, gate terminal, library, hostel | `phase-web-07-operations/SKILL.md` |
| **WEB-08** | AI chat streaming, analytics charts, Super Admin panel | `phase-web-08-ai-analytics/SKILL.md` |
| **WEB-09** | SEO, GA4, GTM events, Core Web Vitals, PWA, a11y audit | `phase-web-09-seo-ga-gtm/SKILL.md` |

## Design System Principles
- **Font:** Plus Jakarta Sans (display) + Inter (body) + JetBrains Mono (code)
- **Colors:** Deep navy sidebar (#0F2028) + Steel blue primary (#1A6FE8) + semantic status palette
- **Radius:** 10px cards, 6px badges, 16px modals
- **Animation:** Framer Motion — slideUp stagger on cards, 200-350ms durations
- **Charts:** Recharts with CSS variables — fully theme-aware (light + dark)
- **Tables:** TanStack Table v8 — sort, filter, paginate, skeleton rows
- **Accessibility:** WCAG 2.1 AA — keyboard nav, ARIA, 4.5:1 contrast minimum
