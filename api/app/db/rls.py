"""Row-level security helpers used by Alembic migrations.

Policy: a row is visible/writable when its school_id equals the transaction's
``app.current_school_id`` setting, or when ``app.bypass_rls`` is 'on' (super
admin and system jobs). Missing settings fail closed: nothing is visible.
"""
from alembic import op

_FUNCTIONS = [
    """CREATE OR REPLACE FUNCTION app_current_school() RETURNS uuid LANGUAGE sql STABLE AS
       $$ SELECT nullif(current_setting('app.current_school_id', true), '')::uuid $$""",
    """CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean LANGUAGE sql STABLE AS
       $$ SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on' $$""",
]


def create_functions() -> None:
    for stmt in _FUNCTIONS:
        op.execute(stmt)


def drop_functions() -> None:
    op.execute("DROP FUNCTION IF EXISTS app_current_school()")
    op.execute("DROP FUNCTION IF EXISTS app_rls_bypass()")


def enable_tenant_rls(table: str, column: str = "school_id") -> None:
    cond = f"({column} = app_current_school() OR app_rls_bypass())"
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {cond} WITH CHECK {cond}")


def enable_bypass_only_rls(table: str) -> None:
    """For tables that only system/auth code may touch."""
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING (app_rls_bypass()) WITH CHECK (app_rls_bypass())")


def disable_rls(table: str) -> None:
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
