"""Tenant isolation is enforced by Postgres itself, not just by service code."""
import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.core.database import system_session
from app.models import User
from tests import factories
from tests.factories import API


async def test_rls_filters_rows_without_any_where_clause(db, school, other_school):
    await factories.user(db, school, "a@alpha.edu", "teacher")
    await factories.user(db, other_school, "b@beta.edu", "teacher")

    async with system_session(school.id, bypass=False) as s:
        emails = (await s.scalars(select(User.email))).all()
    assert emails == ["a@alpha.edu"]

    async with system_session(None, bypass=False) as s:  # no context -> fail closed
        assert (await s.scalars(select(User.email))).all() == []


async def test_rls_blocks_writes_into_another_school(school, other_school):
    with pytest.raises(DBAPIError, match="row-level security"):
        async with system_session(school.id, bypass=False) as s:
            s.add(User(school_id=other_school.id, email="x@beta.edu", full_name="X", role="teacher", password_hash="x"))
            await s.flush()


async def test_api_cannot_reach_other_school_records(client, db, school, admin_headers, other_school):
    victim = await factories.user(db, other_school, "victim@beta.edu", "teacher")
    assert (await client.get(f"{API}/users/{victim.id}", headers=admin_headers)).status_code == 404
    patch = await client.patch(f"{API}/users/{victim.id}", headers=admin_headers, json={"full_name": "Hacked"})
    assert patch.status_code == 404
    assert (await client.delete(f"{API}/users/{victim.id}", headers=admin_headers)).status_code == 404
    listed = (await client.get(f"{API}/users", headers=admin_headers)).json()["data"]
    assert listed and {u["school_id"] for u in listed} == {str(school.id)}


async def test_every_school_owned_table_has_rls(db):
    """Guards future phases: a new table with school_id must get a policy."""
    rows = (await db.execute(text("""
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
               EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND (c.relname = 'schools' OR EXISTS (
                SELECT 1 FROM information_schema.columns col
                WHERE col.table_name = c.relname AND col.column_name = 'school_id'))
    """))).all()
    assert rows, "expected tenant tables"
    missing = [r.relname for r in rows if not (r.relrowsecurity and r.relforcerowsecurity and r.has_policy)]
    assert missing == []
