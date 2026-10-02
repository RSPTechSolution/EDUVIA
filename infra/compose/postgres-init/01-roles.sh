#!/bin/sh
# Runs once on first container start.
# - eduvia      : owner role, runs Alembic migrations (superuser in dev)
# - eduvia_app  : runtime role used by the API. NOT a superuser and NOT the
#                 table owner, so Postgres row-level security always applies.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
  CREATE ROLE eduvia_app LOGIN PASSWORD 'eduvia_app_dev' NOSUPERUSER NOBYPASSRLS;
  CREATE DATABASE eduvia_test OWNER eduvia;
EOSQL

for db in eduvia eduvia_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
    GRANT CONNECT ON DATABASE $db TO eduvia_app;
    GRANT USAGE ON SCHEMA public TO eduvia_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE eduvia IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eduvia_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE eduvia IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO eduvia_app;
EOSQL
done
