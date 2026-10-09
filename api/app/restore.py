"""Restore a database backup made by Vidyanexa.

    python -m app.restore storage/backups/eduvia-20261009-020000.zip --yes

Every table's rows are replaced with the backup's. Everyone is signed out. The database must be at the same
migration revision as the backup (run `alembic upgrade` to the revision in the backup's manifest first)."""
import argparse
import asyncio
import sys
from pathlib import Path

from app.services.backup_service import restore_backup


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("backup", type=Path)
    p.add_argument("--yes", action="store_true", help="really replace all data")
    a = p.parse_args()
    if not a.backup.exists():
        sys.exit(f"No such file: {a.backup}")
    if not a.yes:
        sys.exit("This replaces ALL data in the database with the backup. Run again with --yes to go ahead.")
    m = asyncio.run(restore_backup(a.backup))
    print(f"Restored {m['row_total']} rows from {m['created_at']} (schema {m['revision']}).")


if __name__ == "__main__":
    main()
