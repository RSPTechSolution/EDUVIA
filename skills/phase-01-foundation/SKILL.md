---
name: schoolerp-phase-01-foundation
description: >
  Phase 1 of SchoolERP (Python + Flutter) — authentication system with JWT,
  role-based access control (RBAC), school onboarding, Super Admin panel,
  module registry, and Next.js dashboard shell with Flutter auth screens.
  Use when building auth, login, sessions, school settings, users, or layout.
---

# Phase 1 — Foundation, Auth & Shell
## Python FastAPI · Next.js 15 · Flutter

---

## SQLAlchemy Models (api/app/models/)

```python
# api/app/models/base.py
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

# api/app/models/school.py
class School(Base, TimestampMixin):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    domain: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    language: Mapped[str] = mapped_column(String(10), default="en")
    is_active: Mapped[bool] = mapped_column(default=True)
    plan: Mapped[str] = mapped_column(String(50), default="basic")
    settings: Mapped[dict] = mapped_column(default={})

    users = relationship("User", back_populates="school")
    modules = relationship("SchoolModule", back_populates="school")

# api/app/models/user.py
class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(50))  # super_admin|school_admin|principal|teacher|...
    is_active: Mapped[bool] = mapped_column(default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    school = relationship("School", back_populates="users")

    __table_args__ = (UniqueConstraint("school_id", "email", name="uq_school_user_email"),)

class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    refresh_token: Mapped[str] = mapped_column(String(500), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

---

## Pydantic Schemas (api/app/schemas/)

```python
# api/app/schemas/auth.py
from pydantic import BaseModel, EmailStr
from uuid import UUID

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    school_slug: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: UUID
    email: str
    role: str
    school_id: UUID | None
    is_active: bool

    model_config = {"from_attributes": True}

class LoginResponse(BaseModel):
    tokens: TokenResponse
    user: UserOut
```

---

## Auth Service (api/app/services/auth_service.py)

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, UserSession
from app.core.config import settings
from app.core.exceptions import UnauthorizedException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({**data, "exp": expire}, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

async def login(db: AsyncSession, email: str, password: str, school_slug: str | None):
    # Find school
    school_id = None
    if school_slug:
        school = await db.scalar(select(School).where(School.slug == school_slug))
        if not school:
            raise UnauthorizedException("Invalid credentials")
        school_id = school.id

    # Find user
    stmt = select(User).where(
        User.email == email,
        User.school_id == school_id,
        User.is_active == True,
        User.deleted_at == None,
    )
    user = await db.scalar(stmt)

    if not user or not verify_password(password, user.password_hash):
        raise UnauthorizedException("Invalid credentials")

    # Create tokens
    payload = {"sub": str(user.id), "school_id": str(user.school_id), "role": user.role}
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Store session
    session = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    user.last_login_at = datetime.utcnow()
    await db.commit()

    return {"tokens": {"access_token": access_token, "refresh_token": refresh_token}, "user": user}
```

---

## Auth Router (api/app/routers/auth.py)

```python
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.base import ApiResponse
from app.services import auth_service
from app.core.dependencies import get_current_user

router = APIRouter()

@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await auth_service.login(db, body.email, body.password, body.school_slug)
    return ApiResponse(data=result)

@router.post("/logout")
async def logout(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    await auth_service.logout(db, current_user.id)
    return ApiResponse(data={"message": "Logged out"})

@router.post("/refresh", response_model=ApiResponse)
async def refresh(body: dict, db: AsyncSession = Depends(get_db)):
    result = await auth_service.refresh_token(db, body.get("refresh_token"))
    return ApiResponse(data=result)

@router.get("/me", response_model=ApiResponse)
async def me(current_user=Depends(get_current_user)):
    return ApiResponse(data=current_user)
```

---

## RBAC (api/app/core/permissions.py)

```python
from functools import wraps
from fastapi import HTTPException, Depends
from app.core.dependencies import get_current_user

PERMISSIONS = {
    "students.view":   ["school_admin","principal","teacher","accountant","receptionist"],
    "students.create": ["school_admin","principal","receptionist"],
    "students.edit":   ["school_admin","principal","receptionist"],
    "students.delete": ["school_admin"],
    "fees.view":       ["school_admin","principal","accountant"],
    "fees.collect":    ["school_admin","accountant"],
    "attendance.mark": ["school_admin","principal","teacher"],
    "users.manage":    ["school_admin"],
    "schools.manage":  ["super_admin"],
}

def require_permission(permission: str):
    async def checker(current_user=Depends(get_current_user)):
        allowed = PERMISSIONS.get(permission, [])
        if current_user.role not in allowed:
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")
        return current_user
    return Depends(checker)

# Usage:
# @router.get("/students", dependencies=[require_permission("students.view")])
```

---

## Flutter Auth Feature

```
mobile/lib/features/auth/
├── models/
│   └── auth_state.dart        (freezed)
├── providers/
│   └── auth_provider.dart     (AsyncNotifierProvider)
├── screens/
│   ├── login_screen.dart
│   └── forgot_password_screen.dart
└── widgets/
    ├── login_form.dart
    └── school_slug_input.dart
```

```dart
// lib/features/auth/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:schoolerp/core/api/api_client.dart';

part 'auth_provider.freezed.dart';

@freezed
class AuthState with _$AuthState {
  const factory AuthState.initial() = _Initial;
  const factory AuthState.loading() = _Loading;
  const factory AuthState.authenticated({required Map<String, dynamic> user}) = _Authenticated;
  const factory AuthState.unauthenticated() = _Unauthenticated;
  const factory AuthState.error({required String message}) = _Error;
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  final _storage = const FlutterSecureStorage();

  @override
  Future<AuthState> build() async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      try {
        final api = ref.read(apiClientProvider);
        final res = await api.get('/api/v1/auth/me');
        return AuthState.authenticated(user: res['data']);
      } catch (_) {
        await _storage.deleteAll();
      }
    }
    return const AuthState.unauthenticated();
  }

  Future<void> login(String email, String password, String? schoolSlug) async {
    state = const AsyncValue.loading();
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/v1/auth/login', data: {
        'email': email,
        'password': password,
        if (schoolSlug != null) 'school_slug': schoolSlug,
      });
      final data = res['data'];
      await _storage.write(key: 'access_token', value: data['tokens']['access_token']);
      await _storage.write(key: 'refresh_token', value: data['tokens']['refresh_token']);
      state = AsyncValue.data(AuthState.authenticated(user: data['user']));
    } catch (e) {
      state = AsyncValue.data(AuthState.error(message: e.toString()));
    }
  }

  Future<void> logout() async {
    await _storage.deleteAll();
    state = const AsyncValue.data(AuthState.unauthenticated());
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
```

```dart
// lib/features/auth/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _slugCtrl = TextEditingController();
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (_, next) {
      next.whenData((state) {
        state.whenOrNull(
          authenticated: (_) => context.go('/dashboard'),
          error: (msg) => ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), backgroundColor: Colors.red),
          ),
        );
      });
    });

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo
              const Icon(Icons.school, size: 72, color: Color(0xFF1A3C5E)),
              const SizedBox(height: 8),
              Text('SchoolERP', style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold, color: const Color(0xFF1A3C5E))),
              const SizedBox(height: 40),

              TextFormField(
                controller: _slugCtrl,
                decoration: const InputDecoration(labelText: 'School ID (slug)', prefixIcon: Icon(Icons.business)),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email)),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passCtrl,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock),
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: authState.isLoading
                  ? null
                  : () => ref.read(authProvider.notifier).login(
                      _emailCtrl.text, _passCtrl.text,
                      _slugCtrl.text.isEmpty ? null : _slugCtrl.text),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A3C5E),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: authState.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Sign In', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## Testing Guide — Phase 1

### Python API Tests

```python
# api/tests/integration/test_auth.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_login_success():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "email": "school@demo.com",
            "password": "School@123",
            "school_slug": "demo"
        })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "access_token" in data["data"]["tokens"]
    assert "password_hash" not in str(data)  # never leak hash

@pytest.mark.asyncio
async def test_login_wrong_password():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "email": "school@demo.com", "password": "wrongpass", "school_slug": "demo"
        })
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_me_requires_auth():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_tenant_isolation():
    """User from school A cannot access school B data"""
    token_a = await get_token("school_a@demo.com", "demo-a")
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/students",
            headers={"Authorization": f"Bearer {token_a}"}
        )
    data = res.json()
    # All returned students must belong to school A
    for student in data["data"]["items"]:
        assert student["school_id"] == SCHOOL_A_ID
```

### Flutter Tests

```dart
// test/features/auth/auth_provider_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockito/mockito.dart';

void main() {
  group('AuthNotifier', () {
    test('login sets authenticated state on success', () async {
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(MockApiClient()),
      ]);
      final notifier = container.read(authProvider.notifier);
      await notifier.login('test@demo.com', 'password', 'demo');
      final state = container.read(authProvider).value;
      expect(state, isA<_Authenticated>());
    });

    test('login sets error state on failure', () async { ... });
    test('logout clears storage and sets unauthenticated', () async { ... });
  });
}
```

```bash
# Run all tests
cd api && pytest tests/ -v --cov=app --cov-report=term-missing
cd mobile && flutter test
cd mobile && flutter test integration_test/  # on emulator/device
```

---

## Antigravity Prompt for Phase 1

```
@file skills/master-plan/SKILL.md
@file skills/phase-01-foundation/SKILL.md

Build Phase 1 of SchoolERP:
1. Create all SQLAlchemy models (School, SchoolModule, User, UserSession, AuditLog)
2. Run Alembic migration: alembic revision --autogenerate -m "phase1" && alembic upgrade head
3. Build FastAPI auth router (login, logout, refresh, me) with Pydantic schemas
4. Build school management router (CRUD, module registry toggle)
5. Build users router (CRUD, role assignment, soft delete)
6. Implement RBAC permission checker as FastAPI Depends()
7. Build Next.js dashboard shell: sidebar (role/module aware), header, theme toggle
8. Build Flutter login screen with Riverpod AuthNotifier, Dio API client, go_router
9. Create seed script with demo school, admin, students, staff
10. Write all Python tests (pytest) and Flutter tests (flutter_test)
11. Run: pytest tests/ -v && flutter test
```
