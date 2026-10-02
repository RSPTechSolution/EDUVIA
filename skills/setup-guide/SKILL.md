---
name: schoolerp-setup
description: >
  Complete environment setup for SchoolERP (Python + FastAPI + Flutter).
  Covers Python 3.12, FastAPI, PostgreSQL, Redis, MinIO, MeiliSearch via Docker,
  Flutter 3.x SDK, Next.js 15, project scaffolding, Alembic migrations, and seed.
  Run once before starting Phase 1.
---

# SchoolERP — Complete Setup Guide
## Python + FastAPI · Next.js 15 · Flutter 3.x

---

## Step 1 — Install Prerequisites

### Python 3.12
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y python3.12 python3.12-venv python3-pip

# macOS
brew install python@3.12

python3.12 --version   # 3.12.x
```

### Node.js 20 (for Next.js web)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
node --version   # v20.x.x
npm install -g pnpm@9
```

### Flutter 3.x SDK
```bash
# Linux
sudo snap install flutter --classic
flutter --version   # 3.24+

# macOS
brew install --cask flutter

# Verify everything
flutter doctor   # fix any issues shown
```

### Docker Desktop
```bash
# Install from https://www.docker.com/products/docker-desktop
docker --version          # 24+
docker compose version    # v2.x
```

---

## Step 2 — Create Project Structure

```bash
mkdir schoolerp && cd schoolerp
git init

# Create directory tree
mkdir -p api/app/{core,models,schemas,routers,services,tasks,templates,utils}
mkdir -p api/{alembic,tests/{unit,integration,e2e}}
mkdir -p web/src/{app,components,lib,hooks}
mkdir -p mobile/lib/{core/{api,router,theme,utils},features,shared}
mkdir -p mobile/{test,integration_test}
mkdir -p infra/{compose,caddy}
mkdir -p skills
```

---

## Step 3 — Docker Services

```bash
cat > infra/compose/docker-compose.dev.yml << 'COMPOSE'
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    container_name: schoolerp_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: schoolerp
      POSTGRES_PASSWORD: schoolerp_secret
      POSTGRES_DB: schoolerp
    ports: ["5432:5432"]
    volumes: [pg_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U schoolerp"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: schoolerp_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    ports: ["6379:6379"]
    volumes: [redis_data:/data]

  minio:
    image: minio/minio:latest
    container_name: schoolerp_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio_data:/data]

  meilisearch:
    image: getmeili/meilisearch:v1.8
    container_name: schoolerp_meili
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: schoolerp_meili_key
      MEILI_NO_ANALYTICS: "true"
    ports: ["7700:7700"]
    volumes: [meili_data:/meili_data]

volumes:
  pg_data:
  redis_data:
  minio_data:
  meili_data:
COMPOSE

docker compose -f infra/compose/docker-compose.dev.yml up -d
docker compose -f infra/compose/docker-compose.dev.yml ps
```

---

## Step 4 — Python API Setup

```bash
cd api

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# requirements.txt
cat > requirements.txt << 'REQ'
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.29.0
alembic==1.13.3
pydantic==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
celery[redis]==5.4.0
redis[hiredis]==5.1.1
aioboto3==13.1.1
meilisearch-python-sdk==3.3.0
fastapi-mail==1.4.1
jinja2==3.1.4
weasyprint==62.3
pillow==10.4.0
openpyxl==3.1.5
pandas==2.2.3
python-socketio==5.11.4
langchain==0.3.7
langchain-openai==0.2.8
langchain-google-genai==2.0.4
python-barcode==0.15.1
qrcode[pil]==7.4.2
httpx==0.27.2
REQ

# requirements-dev.txt
cat > requirements-dev.txt << 'REQDEV'
pytest==8.3.3
pytest-asyncio==0.24.0
pytest-cov==5.0.0
httpx==0.27.2
factory-boy==3.3.1
faker==30.3.0
REQDEV

pip install -r requirements.txt -r requirements-dev.txt
```

### FastAPI App Entry

```python
# api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import create_tables
from app.core.config import settings
from app.routers import (
    auth, schools, users, students, academics,
    attendance, fees, exams, communication,
    transport, hr, library, hostel, security,
    ai_analytics, super_admin
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield

app = FastAPI(
    title="SchoolERP API",
    description="Multi-tenant School Management System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
for router, prefix, tags in [
    (auth.router,        "/auth",        ["Auth"]),
    (schools.router,     "/schools",     ["Schools"]),
    (users.router,       "/users",       ["Users"]),
    (students.router,    "/students",    ["Students"]),
    (academics.router,   "/academics",   ["Academics"]),
    (attendance.router,  "/attendance",  ["Attendance"]),
    (fees.router,        "/fees",        ["Fees"]),
    (exams.router,       "/exams",       ["Exams"]),
    (communication.router,"/communication",["Communication"]),
    (transport.router,   "/transport",   ["Transport"]),
    (hr.router,          "/hr",          ["HR"]),
    (library.router,     "/library",     ["Library"]),
    (hostel.router,      "/hostel",      ["Hostel"]),
    (security.router,    "/security",    ["Security"]),
    (ai_analytics.router,"/ai",          ["AI & Analytics"]),
    (super_admin.router, "/super-admin", ["Super Admin"]),
]:
    app.include_router(router, prefix=f"/api/v1{prefix}", tags=tags)
```

### Core Config (Pydantic Settings)

```python
# api/app/core/config.py
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "schoolerp"
    MINIO_SECURE: bool = False
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    MEILI_HOST: str = "http://localhost:7700"
    MEILI_MASTER_KEY: str = "schoolerp_meili_key"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8081"]

    class Config:
        env_file = ".env"

settings = Settings()
```

### Database Setup (SQLAlchemy 2.0 Async)

```python
# api/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=40,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### Alembic Setup

```bash
cd api
alembic init alembic

# alembic/env.py — key changes:
# from app.models import *  (import all models so Alembic sees them)
# target_metadata = Base.metadata
# config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("+asyncpg",""))

# Create first migration
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

---

## Step 5 — Flutter Setup

```bash
cd mobile

# pubspec.yaml
cat > pubspec.yaml << 'PUBSPEC'
name: schoolerp_mobile
description: SchoolERP Mobile App
version: 1.0.0+1

environment:
  sdk: ">=3.4.0 <4.0.0"
  flutter: ">=3.24.0"

dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Navigation
  go_router: ^14.2.7

  # HTTP
  dio: ^5.7.0
  pretty_dio_logger: ^1.4.0

  # Storage
  flutter_secure_storage: ^9.2.2
  shared_preferences: ^2.3.2
  sqflite: ^2.3.3+1       # offline queue (GPS, attendance)

  # Maps & Location
  flutter_map: ^7.0.2
  latlong2: ^0.9.1
  geolocator: ^13.0.1
  background_fetch: ^1.2.3  # background GPS

  # Camera & QR
  mobile_scanner: ^5.2.3   # QR code scanner (replaces qr_code_scanner)
  image_picker: ^1.1.2

  # Firebase
  firebase_core: ^3.5.0
  firebase_messaging: ^15.1.3

  # Payments
  razorpay_flutter: ^1.3.7

  # Video/Audio
  chewie: ^1.8.1
  audioplayers: ^6.1.0

  # Utils
  intl: ^0.19.0
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0
  dio_cache_interceptor: ^3.5.0
  connectivity_plus: ^6.0.5
  permission_handler: ^11.3.1
  url_launcher: ^6.3.0
  path_provider: ^2.1.4
  image_cropper: ^8.0.2
  fl_chart: ^0.69.0         # Charts for analytics
  shimmer: ^3.0.0            # Loading skeletons
  cached_network_image: ^3.4.1
  lottie: ^3.1.2             # Animations
  open_filex: ^4.5.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  integration_test:
    sdk: flutter
  riverpod_generator: ^2.4.3
  freezed: ^2.5.7
  json_serializable: ^6.8.0
  build_runner: ^2.4.12
  mockito: ^5.4.4
  flutter_lints: ^4.0.0
PUBSPEC

flutter pub get

# Generate code (freezed + riverpod)
dart run build_runner build --delete-conflicting-outputs
```

### Core API Client (Dio)

```dart
// lib/core/api/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiClient({required String baseUrl}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
    ));

    _dio.interceptors.addAll([
      _AuthInterceptor(_storage, _dio),
      LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? params}) async {
    final res = await _dio.get(path, queryParameters: params);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> post(String path, {dynamic data}) async {
    final res = await _dio.post(path, data: data);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> put(String path, {dynamic data}) async {
    final res = await _dio.put(path, data: data);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final res = await _dio.delete(path);
    return res.data as Map<String, dynamic>;
  }
}

class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  final Dio _dio;

  _AuthInterceptor(this._storage, this._dio);

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Attempt token refresh
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken != null) {
        try {
          final res = await _dio.post('/api/v1/auth/refresh',
            data: {'refresh_token': refreshToken},
            options: Options(headers: {'Authorization': ''}),
          );
          final newToken = res.data['data']['access_token'];
          await _storage.write(key: 'access_token', value: newToken);
          // Retry original request
          err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
          final retryRes = await _dio.fetch(err.requestOptions);
          return handler.resolve(retryRes);
        } catch (_) {
          await _storage.deleteAll();
        }
      }
    }
    handler.next(err);
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(baseUrl: 'http://localhost:8000');
});
```

---

## Step 6 — Next.js Web Setup

```bash
cd web
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label card table badge dialog sheet \
  dropdown-menu form select textarea checkbox toast sonner avatar skeleton \
  tabs calendar chart
pnpm add @tanstack/react-query axios recharts lucide-react
pnpm add react-hook-form @hookform/resolvers zod next-themes
pnpm add @tanstack/react-table date-fns clsx tailwind-merge
```

---

## Step 7 — Environment Files

```bash
# api/.env
cat > api/.env << 'ENV'
DATABASE_URL=postgresql+asyncpg://schoolerp:schoolerp_secret@localhost:5432/schoolerp
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
JWT_REFRESH_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=schoolerp
MINIO_SECURE=false
ENVIRONMENT=development
DEBUG=true
ENV

# mobile — set API URL in lib/core/api/api_client.dart for dev
# Production: use --dart-define=API_URL=https://api.yourschool.com
```

---

## Step 8 — Run Initial Migration + Seed

```bash
cd api
source venv/bin/activate
alembic upgrade head
python -m app.seed
# Creates: 1 super admin, 1 demo school, 10 students, 5 staff, demo data
```

---

## Step 9 — Start Development Servers

```bash
# Terminal 1: API
cd api && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
# Visit: http://localhost:8000/docs  (Swagger UI — auto-generated!)

# Terminal 2: Celery worker (background jobs)
cd api && source venv/bin/activate
celery -A app.tasks.worker worker --loglevel=info

# Terminal 3: Web
cd web && pnpm dev
# Visit: http://localhost:3000

# Terminal 4: Flutter (parent app)
cd mobile && flutter run --dart-define=FLAVOR=parent

# Terminal 5: Flutter (staff app)
cd mobile && flutter run --dart-define=FLAVOR=staff -d <second_device_or_emulator>
```

---

## Step 10 — Antigravity IDE Config

1. Open Antigravity IDE → point at `schoolerp/` folder
2. Always load at session start:
   ```
   @file skills/master-plan/SKILL.md
   @file skills/phase-01-foundation/SKILL.md
   ```
3. Use exact Antigravity prompts from each phase SKILL.md
4. Antigravity runs terminal: `alembic upgrade head`, `pytest`, `flutter test`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `asyncpg` connection refused | Docker not running — `docker compose up -d` |
| `alembic upgrade` fails | Check `DATABASE_URL` in `api/.env` |
| Flutter doctor errors | Run `flutter doctor` and fix each item |
| Port 8000 in use | Change `API_PORT` in `.env` |
| MinIO bucket missing | Open http://localhost:9001 → create `schoolerp` bucket |
| `ModuleNotFoundError` in pytest | Activate venv: `source venv/bin/activate` |
| Flutter pub get fails | Run `flutter clean && flutter pub get` |
| Celery tasks not running | Start worker: `celery -A app.tasks.worker worker` |
