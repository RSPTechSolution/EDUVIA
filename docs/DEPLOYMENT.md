# Deploying EDUVIA

EDUVIA runs on one Linux server with Docker. Five containers:

| Container | What it does |
|---|---|
| `nginx` | The only thing open to the internet. Sends `/api/v1/*` and `/iclock` to the API, and everything else to the web app. |
| `web` | The website and web app (Next.js). |
| `api` | The API (FastAPI). It applies database migrations when it starts, and makes the daily backup. |
| `postgres` | The database (PostgreSQL 16) with row-level security. |
| `redis` | Rate limits, sign-in codes, and short-lived locks. |

Uploaded files and backups live in the `api_storage` volume; the database lives in `pg_data`.

## What you need

- A server with 2 CPUs, 4 GB RAM and 40 GB disk (Ubuntu 22.04 or later).
- Docker Engine 24+ with the Compose plugin.
- The server's address. A custom domain isn't needed: an IP address, or a hostname your cloud provider gives you, works.

## 1. Settings

```sh
git clone <this repository> eduvia && cd eduvia/infra/compose
cp .env.prod.example .env.prod
```

Fill in `.env.prod`:

- `PUBLIC_URL`: the address people will open, with no trailing slash. For example `http://203.0.113.10` or `https://eduvia.example-cloud.app`.
- `OWNER_DB_PASSWORD`, `APP_DB_PASSWORD` and `JWT_SECRET_KEY`: long random values. Make each one with:
  `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.
- `COOKIE_SECURE`: leave it at `true` whenever the site is served over **https**. Set it to `false` only for a short trial over plain http on an IP address, never with real school data.
- Email, SMS, WhatsApp, push and AI keys: optional. While a provider is set to `console`, its messages are written to the API log instead of being sent.

`.env.prod` holds secrets: it is in `.gitignore`, and should be readable only by the admin (`chmod 600 .env.prod`).

## 2. Start

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

On its first start, Postgres creates the two database roles:

- `eduvia` owns the tables and runs migrations.
- `eduvia_app` is used by the API. It doesn't own the tables, so row-level security always applies to it.

Then open `PUBLIC_URL`.

## 3. The first platform admin

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api \
  python -m app.create_super_admin --email you@example.in --name "Your Name"
```

It prints a temporary password. Sign in with it, leaving the school ID empty, and you are asked to choose your own. From **Platform → Schools** you then add schools; each school admin gets their own sign-in.

For a demo server (with `ENVIRONMENT=staging`, not `production`) you can load the sample school instead:
`docker compose ... exec api python -m app.seed`.

## HTTPS

Schools should only use EDUVIA over https.

- **If your cloud gives you a hostname with a certificate** (a load balancer, or a platform such as Render or Railway): point it at port 80 of this server, and set `PUBLIC_URL` to the https address.
- **On a plain server**: put a TLS-terminating proxy in front of nginx. For example, Caddy obtains certificates automatically for any hostname that resolves to the server.

## Backups and restore

- With `BACKUP_DAILY=true`, the API writes one backup a day to `/data/storage/backups` and keeps the newest `BACKUP_KEEP`. The backup is one consistent snapshot of every table, as CSV files in a zip.
- The platform admin can also make, download and delete backups under **Platform → System → Backups**.
- **Keep copies off the server.** Download backups regularly, or sync the volume to object storage:
  `docker run --rm -v eduvia-prod_api_storage:/s alpine tar -C /s -czf - backups > backups.tgz`

To restore, the database must be at the same migration revision as the backup. The revision is in the backup's `manifest.json`.

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod cp eduvia-YYYYMMDD-HHMMSS.zip api:/tmp/
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api python -m app.restore /tmp/eduvia-YYYYMMDD-HHMMSS.zip --yes
```

A restore replaces all data and signs everyone out.

## Updating

```sh
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations run automatically when the API starts. Make a backup first.

## Health and logs

- **Platform → System → Health** shows:
  - The database, Redis, disk space and the age of the newest backup.
  - Which email, SMS, push, payment and AI providers are live.
  - Usage.
- `GET /api/v1/health` returns `{"status": "ok"}` for an uptime monitor.
- Logs: `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api web`

## Mobile apps

The parent, staff and driver apps talk to `PUBLIC_URL/api/v1`. Build them with that address:

```sh
cd mobile
flutter build apk --dart-define=FLAVOR=parent --dart-define=API_URL=https://your-address
```

Repeat with `FLAVOR=staff` and `FLAVOR=driver`.
