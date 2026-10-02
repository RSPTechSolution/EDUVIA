# EDUVIA

Multi-school management platform: a FastAPI backend, a Next.js web dashboard, and Flutter apps for parents, staff and drivers.

| Part | Stack | Folder |
|---|---|---|
| API | Python 3.14, FastAPI, SQLAlchemy 2 (async), PostgreSQL 16, Redis 7 | `api/` |
| Web | Next.js 15, React 19, Tailwind v4, shadcn/ui (Base UI), TanStack Query/Table | `web/` |
| Mobile | Flutter 3.47, Riverpod 3, go_router, Dio | `mobile/` |
| Infra | Docker Compose (Postgres, Redis) | `infra/compose/` |

## How it fits together

- **Tenancy.** Every school-owned table has a `school_id` and a Postgres row-level security policy. The API connects as `eduvia_app`, a role that is neither superuser nor table owner, so the database itself refuses cross-school reads and writes. Migrations run as the owner role.
- **Auth.** Short-lived JWT access tokens (30 min) are bound to a server-side session; refresh tokens are opaque, stored hashed, rotated on every use, and replaying an old one revokes the session. Logout, password changes and deactivation take effect immediately.
- **Web.** The browser never sees a token: they live in httpOnly cookies, Next.js middleware refreshes them, and the browser calls the API through a same-origin proxy (`/api/proxy/*`).
- **Mobile.** Tokens are kept in secure storage; Dio refreshes once when several requests expire together.
- **Errors.** Every API error has the same shape: `{"success": false, "error": {"code", "message", "details?"}}`.

## Run it locally

Prerequisites: Docker Desktop, Python 3.12+ (3.14 tested), Node 20+, Flutter 3.47+.

```bash
# 1. Database and Redis
docker compose -f infra/compose/docker-compose.dev.yml up -d

# 2. API  (http://localhost:8000, docs at /docs)
cd api
python -m venv venv && venv/Scripts/activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                  # then set JWT_SECRET_KEY (see the comment in the file)
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1

# 3. Web  (http://localhost:3000)
cd web
cp .env.example .env.local
npm install
npm run dev

# 4. Mobile
cd mobile
flutter pub get
flutter run --flavor parent                           # Android: parent | staff | driver
flutter run -d chrome --dart-define=FLAVOR=parent     # web (add http://localhost:<port> to the API's CORS_ORIGINS)
```

### Demo accounts (created by `python -m app.seed`)

| Who | School ID | Email | Password |
|---|---|---|---|
| Platform admin | *(blank)* | superadmin@eduvia.com | Admin@1234 |
| School admin | demo | admin@demo.com | Demo@1234 |
| Principal / teacher / accountant / receptionist | demo | principal@ · teacher@ · accounts@ · reception@demo.com | Demo@1234 |
| Parent / student / driver | demo | parent@ · student@ · driver@demo.com | Demo@1234 |

## Tests

```bash
cd api    && pytest                        # integration tests against the eduvia_test database
cd web    && npm test                      # unit tests (Vitest)
cd web    && npm run build && npm run start   # then, in another shell:
cd web    && npx playwright test           # end-to-end, needs the API and web running
cd mobile && flutter analyze && flutter test
```

The end-to-end tests run against the dev database and create a few users and schools prefixed `e2e`.

## Build status

Built so far (checkpoint 1, foundation): authentication, roles and permissions, schools, users, modules, audit log, the web design system and app shell, and the mobile sign-in flow for all three apps. The module phases (students, attendance, fees, exams, …) follow the plan in `skills/`.

Not verifiable on this development machine yet: Android builds (no Android SDK installed) and iOS builds (need a Mac; iOS flavors also need Xcode schemes — until then use `--dart-define=FLAVOR=…`).
