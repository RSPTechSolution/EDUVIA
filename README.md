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

## Run it locally (step by step)

### 1. Install the tools

| Tool | Version | Check with |
|---|---|---|
| Git | any recent | `git --version` |
| Docker Desktop | 24+ (must be **running**) | `docker info` |
| Python | 3.12 or newer (3.14 tested) | `python --version` (Windows: `py --version`) |
| Node.js | 20 or newer | `node --version` |
| Flutter | 3.47+ (only for the mobile apps) | `flutter --version` |

These ports must be free: **5433** (Postgres), **6380** (Redis), **8000** (API), **3000** (web), **8090** (Flutter web, optional).

### 2. Get the code

```bash
git clone <your-repo-url> EDUVIA
cd EDUVIA
```

### 3. Start the database and Redis

```bash
docker compose -f infra/compose/docker-compose.dev.yml up -d
docker compose -f infra/compose/docker-compose.dev.yml ps     # both should show "healthy"
```

The first start also creates the `eduvia_app` database role and the `eduvia_test` database.

### 4. Set up the API

Open a terminal in `api/`.

**Windows (PowerShell)**
```powershell
cd api
py -m venv venv
.\venv\Scripts\Activate.ps1            # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Now create a secret and paste it into `api/.env` as `JWT_SECRET_KEY=...`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Create the tables and the demo data, then start the API:

```bash
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
```

Check it: open http://localhost:8000/api/v1/health — it should say `"status":"ok"`. API docs are at http://localhost:8000/docs.

Leave this terminal running.

### 5. Set up the web dashboard

Open a **second** terminal in `web/`:

```bash
cd web
npm install
cp .env.example .env.local          # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000 and sign in with School ID `demo`, `admin@demo.com`, `Demo@1234` (see all demo accounts below).

For a production-like run instead of `npm run dev`: `npm run build` then `npm run start`.

### 6. Run the mobile apps (optional)

Open a **third** terminal in `mobile/`:

```bash
cd mobile
flutter pub get
```

Pick one way to run it:

- **In Chrome (easiest, no phone needed)**
  ```bash
  flutter run -d chrome --web-port 8090 --dart-define=FLAVOR=parent
  ```
  Port 8090 is already allowed in the API's `CORS_ORIGINS`. To use another port, add it there and restart the API.

- **Android emulator** (needs Android Studio + an emulator). The app reaches your PC's API at `10.0.2.2:8000` automatically:
  ```bash
  flutter run --flavor parent          # or: staff, driver
  ```

- **Real phone on the same Wi-Fi.** Start the API with `--host 0.0.0.0`, find your PC's local IP (e.g. `192.168.1.20`), then:
  ```bash
  flutter run --flavor parent --dart-define=API_URL=http://192.168.1.20:8000
  ```

The parent app accepts parent/student accounts, the staff app accepts staff roles, the driver app accepts drivers.

### Stopping and starting again

- Stop the API / web / Flutter: press `Ctrl+C` in their terminals.
- Stop the database: `docker compose -f infra/compose/docker-compose.dev.yml stop` (data is kept).
- Next time: start Docker, run `docker compose ... up -d`, activate the venv, and run only the `uvicorn` and `npm run dev` commands. Run `alembic upgrade head` again whenever you pull new code.

### Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET_KEY must be set` | Put a generated secret in `api/.env` (step 4). |
| `connection refused` on port 5433 | Docker isn't running, or run `docker compose ... up -d`. |
| `port is already allocated` | Something else uses 5433/6380; stop it or change the left-hand port in `docker-compose.dev.yml` and the matching URLs in `api/.env`. |
| `role "eduvia_app" does not exist` | The database volume was created by an older setup. Reset it (deletes local data): `docker compose -f infra/compose/docker-compose.dev.yml down -v` then `up -d`, then re-run `alembic upgrade head` and `python -m app.seed`. |
| Web shows "Something went wrong" or sends you back to sign-in | The API isn't running on port 8000, or `web/.env.local` is missing. |
| Login says "Too many login attempts" | Wait 15 minutes, or clear Redis: `docker exec eduvia_redis redis-cli flushdb`. |
| Flutter web can't reach the API | Its port must be listed in `CORS_ORIGINS` in `api/.env`; restart the API after changing it. |

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
cd web    && npx playwright install chromium   # once
cd web    && npm run build && npm run start    # then, in another shell:
cd web    && npx playwright test               # end-to-end, needs the API and web running
cd mobile && flutter analyze && flutter test
```

The end-to-end tests run against the dev database and create a few users and schools prefixed `e2e`.

## Build status

Built so far (checkpoint 1, foundation): authentication, roles and permissions, schools, users, modules, audit log, the web design system and app shell, and the mobile sign-in flow for all three apps. The module phases (students, attendance, fees, exams, …) follow the plan in `skills/`.

Not verifiable on this development machine yet: Android builds (no Android SDK installed) and iOS builds (need a Mac; iOS flavors also need Xcode schemes — until then use `--dart-define=FLAVOR=…`).
