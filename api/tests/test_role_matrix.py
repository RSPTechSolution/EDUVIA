"""Every GET endpoint, called as every role: the permission each route declares is enforced, and nothing crashes.

Routes are discovered from the app, and each route's permission is read from its `require_permission` dependency, so new
endpoints are covered automatically."""
from fastapi.routing import APIRoute

from app.core.permissions import MODULES, Role, has_permission
from app.main import app
from tests import factories, test_attendance
from tests.factories import API, PASSWORD
from tests.test_campus import _enable, _max_plan

SKIP = {f"{API}/auth/download-link", f"{API}/files/public"}  # not role-gated by design
# Routes whose code also refuses families, beyond the declared permission (HR self-service is for staff).
STAFF_ONLY = (f"{API}/hr/",)
FAMILY = {Role.PARENT, Role.STUDENT}


def _guards(route: APIRoute) -> tuple[set[str], bool]:
    """(permissions the route requires, whether it is super-admin only)."""
    perms, superadmin = set(), False

    def walk(dep):
        nonlocal superadmin
        call = dep.call
        code = getattr(call, "__code__", None)
        if code and call.__name__ == "checker" and call.__closure__:
            names = dict(zip(code.co_freevars, (c.cell_contents for c in call.__closure__)))
            if "permission" in names:
                perms.add(names["permission"])
            elif "module" not in names and "Super admin" in str(code.co_consts):
                superadmin = True
        for d in dep.dependencies:
            walk(d)
    walk(route.dependant)
    return perms, superadmin


def _all_routes():
    """(full path, APIRoute) for every route, looking inside included routers."""
    for r in app.routes:
        if isinstance(r, APIRoute):
            yield r.path, r
        ctx = getattr(r, "include_context", None)
        if ctx:
            for inner in ctx.included_router.routes:
                if isinstance(inner, APIRoute):
                    yield ctx.prefix + inner.path, inner


def _get_routes() -> list[tuple[str, set[str], bool]]:
    out = []
    for path, r in _all_routes():
        if "GET" in r.methods and "{" not in path and path.startswith(API) and path not in SKIP:
            perms, sa = _guards(r)
            out.append((path, perms, sa))
    return sorted(set((p, frozenset(x), s) for p, x, s in out), key=lambda t: t[0])


async def test_every_get_endpoint_for_every_role(client, db, school, admin_headers, super_headers):
    await _max_plan(db, school)
    await _enable(client, admin_headers, *MODULES)
    _, _, parent_pw, _, _ = await test_attendance.setup(client, db, school, admin_headers)
    headers = {Role.SCHOOL_ADMIN: admin_headers, Role.PARENT: await factories.login_headers(client, "mum@t.com", parent_pw, school.slug)}
    for role in Role:
        if role in headers or role in (Role.SUPER_ADMIN,):
            continue
        email = f"{role.value}@matrix.test"
        await factories.user(db, school, email, role.value)
        headers[role] = await factories.login_headers(client, email, PASSWORD, school.slug)

    routes = _get_routes()
    assert len(routes) > 100
    problems = []
    for path, perms, superadmin in routes:
        for role, h in headers.items():
            res = await client.get(path, headers=h)
            allowed = not superadmin and all(has_permission(role, p) for p in perms) and not (role in FAMILY and path.startswith(STAFF_ONLY))
            if res.status_code >= 500:
                problems.append(f"{role.value} GET {path} -> {res.status_code}")
            elif allowed and res.status_code == 403 and res.json()["error"]["code"] == "PERMISSION_DENIED" and perms:
                problems.append(f"{role.value} GET {path} -> 403 but has {perms}")
            elif not allowed and res.status_code != 403 and not (res.status_code == 422 and role in FAMILY and path.startswith(STAFF_ONLY)):
                problems.append(f"{role.value} GET {path} -> {res.status_code} without {perms or 'super admin'}")
        res = await client.get(path, headers=super_headers)
        if res.status_code >= 500:
            problems.append(f"super_admin GET {path} -> {res.status_code}")
    assert not problems, "\n".join(problems)
