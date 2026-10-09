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
To try the staff app in Chrome use `--dart-define=FLAVOR=staff` (same port 8090, so stop the parent app first).

What each app shows (tabs appear only when the school has the module and the account may use it):

| App | Tabs |
|---|---|
| **EDUVIA** (parents, students) | Home (each child's attendance today, fees due, homework to do, today's lessons, notice bell) · Attendance · Homework (tick it off) · Fees (pay online, receipts) · More: Results & report cards, Timetable, Notices, Profile |
| **EDUVIA Staff** | Home (classes left to mark, today's classes, notice bell) · Attendance (mark P/A/L/½/Leave) · Homework (teachers: set it, check it) · Fees (office: search, collect, receipts) · More: Marks entry, Timetable, Notices, Profile |
| **EDUVIA Driver** | Home · More: Notices, Profile (trips and boarding come with the transport module) |

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

### Demo data and accounts (created by `python -m app.seed`)

The seed builds **Green Valley Public School** (school ID `demo`, Max plan, every module on):
Nursery to Class 12 (Classes 11–12 have Science and Commerce sections), ~200 students with
roll numbers and blood groups, ~160 parent accounts (some families have two children), 38 teachers
with subjects, a bell schedule and a complete, clash-free Monday–Saturday timetable.
A few lessons are deliberately left without a teacher so you can try **Timetable → Free teachers**.

It also adds daily attendance from July up to yesterday (a handful of students are below 75%, and
**today is left unmarked** so teachers can take it), fee categories and per-class fees, and three
quarterly invoices per student for 2026-27 with realistic payments: Quarter 1 mostly paid, some
Quarter 2 invoices overdue or part-paid, Quarter 3 just issued. Aarav Patel owes ₹3,000 from Quarter 2,
so the parent account can try paying online.

Exams: **Unit Test 1** (July) and **Half-Yearly** (September) have marks for every student and published
results with class-teacher remarks; **Unit Test 2** (November) has only a date sheet, so teachers can try
entering marks. There are ten notices for different audiences (some unread), and two weeks of homework
for every class, most of it already checked by the teachers.

Run `python -m app.seed --reset` at any time to wipe the demo school and rebuild it (handy after
running the e2e tests, which add records). The data is the same on every machine.

Every school account uses the password **Demo@1234** and school ID **demo**.

| Role | Email | What to try |
|---|---|---|
| Platform admin | superadmin@eduvia.com (password `Admin@1234`, school ID blank) | Schools, plans, leads |
| School admin | admin@demo.com | Everything: students, classes, timetable editing, users, billing |
| Principal | principal@demo.com | Students, classes, timetable editing; can view users and billing but not change school settings, users or billing |
| Teacher | teacher@demo.com (Priya Verma, Maths, class teacher of Class 5 A) | Take attendance, set and check homework, enter Unit Test 2 marks, write report-card remarks, post a notice to her classes |
| Other teachers | e.g. amit.saxena@demo.com, anjali.mehta@demo.com, arijit.sen@demo.com (part-time, off Saturdays) | Each sees their own week |
| Accountant | accounts@demo.com | Fees: dashboard, fee setup, generating invoices, concessions, collecting payments |
| Receptionist | reception@demo.com | Add and edit students, collect fees at the counter, view attendance and timetables |
| Librarian / HR / transport / security / office staff | librarian@ · hr@ · transport@ · security@ · staff@demo.com | Basic access (their modules come in later phases) |
| Driver | driver@ · driver2@ · driver3@demo.com | Basic access |
| Parent | parent@demo.com (Suresh Patel) and mother@demo.com (Kavita Patel) | Aarav (Class 5 A) and Diya (Class 1 A): attendance, homework, results and report cards, notices, fees with online payment (test mode), timetable |
| Other parents | e.g. ajay.sandhu@demo.com (Class 11 and Class 2), archana.gupta@demo.com (Class 7 and UKG) | Parents with two children |
| Student | student@demo.com (Aarav Patel) | Own attendance, homework, results, notices, fees and timetable |
| Senior students | e.g. yash.kohli@students.demo.com (Class 12 Science), aditya.chopra@students.demo.com (Class 12 Commerce) | Own timetable |

Every user is listed under **Settings → Users & roles** when signed in as the admin.

## Tests

```bash
cd api    && pytest                        # integration tests against the eduvia_test database
cd web    && npm test                      # unit tests (Vitest)
cd web    && npx playwright install chromium   # once
cd web    && NEXT_DIST_DIR=.next-prod npm run build   # separate folder, safe next to npm run dev
cd web    && npx playwright test               # end-to-end, needs the API and web running
cd mobile && flutter analyze && flutter test
```

The end-to-end tests run against the dev database and create a few users and schools prefixed `e2e`.

## Plans and the public website

- **Public site:** `/` (home), `/pricing`, `/about`, `/contact`, `/privacy`, `/terms` and `/signup` (self-service 14-day trial).
- **Plans:** Basic ₹2,999, Pro ₹7,999 and Max ₹17,999 per month (yearly = 10 months), stored in the `plans` table and editable by the platform admin under *Platform → Plans*. Custom plans are priced by `api/app/core/pricing.py` (platform fee + chosen modules + tiered per-student rate), so the website and billing always agree. Prices exclude GST.
- **Enforcement:** a module only works if the school's plan includes it (locked modules show which plan unlocks them); adding students or staff beyond the plan's limit is refused with an upgrade prompt; a school can't move to a plan its usage doesn't fit.
- **Changing plans:** during the trial, school admins switch plans instantly from *Plan & billing*. After the trial a change becomes a request in *Platform → Leads* (online payment isn't connected yet). The platform admin can assign any plan, including custom ones, from *Platform → Schools*.
- The demo school is on Max so every feature is visible.

## Attendance and fees

- **Attendance:** teachers mark daily attendance for their class and any section they teach (web: *Attendance*, staff app: *Attendance* tab), with Present / Absent / Late / Half day / Leave and an optional reason. Teachers can correct the last 3 days; admins any past day. Future dates and Sundays are refused. Admins get a school overview (present today, classes marked, a 14-day trend, students below 75% over the last 30 days) and a monthly report per class with CSV export. Parents and students see a calendar and their percentage (leave days don't count against it).
- **Fees:** fee categories and per-class fees per term (*Fees → Fee setup*), one-click invoice generation for a term (never twice for the same student and term), counter collection by cash/UPI/cheque/card/bank transfer with numbered receipts, concessions with a reason, overdue tracking and a collections dashboard. Parents see dues per child and pay online; every payment has a printable receipt.
- **Online payment:** `PAYMENT_GATEWAY=test` (the default in development) simulates a gateway so you can try the full flow without money; the API refuses to start with it in production. Set `PAYMENT_GATEWAY=none` to hide online payment. Razorpay plugs in behind the same order/confirm flow once you have keys.

## Exams, notices and homework

- **Exams:** create an exam (unit test, term or final), build the date sheet class by class or in one click from the timetable, and teachers enter marks only for the subjects and classes they teach (with live CBSE grades A1–E and out-of-range checks). Results show totals, percentages, grades, ranks, subject averages and pass rates, with CSV export; class teachers add report-card remarks. Publishing locks the marks and shows printable report cards to parents and students; unpublishing hides them again.
- **Notices:** the office posts to everyone, staff, parents & students, or chosen classes; teachers post to the classes they teach. Notices can be important/urgent and pinned. Authors see "read by X of Y"; everyone gets an unread badge on the web and a bell in the apps.
- **Homework:** teachers set it for their classes and subjects with a due date; parents or students tick it off (with an optional note); teachers mark it checked or incomplete with a remark, which families see.

## More modules

- **Academics extras:** syllabus with coverage, lesson plans, admission enquiries with a public form (`/apply/<school>`), TC/bonafide/character certificates and ID cards (PDF), year-end promotion, substitutions.
- **Attendance extras:** school calendar and holidays, leave requests from families, QR scanning of ID cards, period-wise attendance, biometric machines (ZKTeco ADMS at `/iclock`).
- **Fees and accounts:** late fees, reminders by email, SMS and WhatsApp, PDF receipts, income and expense vouchers, day book CSV, and Tally XML export.
- **Exams:** online tests with a question bank, co-scholastic grades, live classes (Meet, Zoom or Jitsi), and PDF report cards.
- **Communication:** SMS and WhatsApp (console mode until keys are added), parent-teacher chat, PTM booking, and surveys.
- **Transport:** fleet, routes and stops, a driver app with live GPS, boarding alerts to parents, and SOS.
- **HR and payroll:** staff profiles, staff attendance, leave, monthly payroll with PF, ESI, PT and TDS, and PDF payslips.
- **Campus:** a library (issue and return, fines, overdue reminders), hostels (rooms, beds, allocation), and inventory with an asset register.
- **Gate and security:** visitor log, early-pickup gate passes with a code checked at the gate, a contract-workers register with police verification, a compliance vault with expiry reminders, and CCTV with family consent.
- **Analytics and AI:**
  - Analytics: school-wide reports (enrolment, attendance, fees, results) and students who need attention.
  - AI assistant: answers set questions about the school's own data, within each role's permissions. With an Anthropic key, Claude also routes free-form questions.
- **Platform:**
  - System health, backups and restore, and a school data export.
  - An announcement banner, school brand colours, and sign-in with a one-time code by email or SMS.
  - SEO (sitemap, robots, social previews), an installable web app (PWA), and optional Google Analytics.

## Deploying

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): one server, `docker compose -f infra/compose/docker-compose.prod.yml up -d --build`. nginx serves the website and the API from one address, so no custom domain is needed. Create the first platform admin with `python -m app.create_super_admin`.

## Build status

All modules in the plan are built on the web and in the mobile apps (parent, staff and driver), with demo data from `python -m app.seed`.

Every module is covered by:
- API integration tests, including a matrix that calls every GET endpoint as each of the 15 roles.
- End-to-end browser tests, including one that opens every menu page as each demo role.
- Flutter widget tests.

What needs accounts or hardware before it works for real:
- **Online fee payment:** Razorpay isn't connected; a simulated gateway is used for testing.
- **Delivery:** SMS and WhatsApp sending, push notifications (Firebase), and email (Brevo) need their keys. Until then they log to the console.
- **Builds:** Android builds need the Android SDK; iOS builds need a Mac.
