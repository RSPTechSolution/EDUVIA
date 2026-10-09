#!/bin/sh
# Runs once, on the first start of an empty database volume.
# - $POSTGRES_USER : owner role; runs migrations and backups
# - eduvia_app     : runtime role for the API, NOT a superuser and NOT the table owner, so row-level security always applies
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" -v owner="$POSTGRES_USER" -v db="$POSTGRES_DB" <<-'EOSQL'
  CREATE ROLE eduvia_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOBYPASSRLS;
  GRANT CONNECT ON DATABASE :"db" TO eduvia_app;
  GRANT USAGE ON SCHEMA public TO eduvia_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eduvia_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO eduvia_app;
EOSQL
