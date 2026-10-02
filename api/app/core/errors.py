"""One error shape for every failure: {"success": false, "error": {code, message, details}}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("eduvia")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str | None = None, *, code: str | None = None, details=None, status_code: int | None = None):
        self.message = message or self.code.replace("_", " ").capitalize()
        self.code = code or self.code
        self.details = details
        if status_code:
            self.status_code = status_code
        super().__init__(self.message)


class BadRequest(AppError):
    status_code, code = 400, "BAD_REQUEST"


class Unauthorized(AppError):
    status_code, code = 401, "UNAUTHORIZED"


class Forbidden(AppError):
    status_code, code = 403, "FORBIDDEN"


class NotFound(AppError):
    status_code, code = 404, "NOT_FOUND"


class Conflict(AppError):
    status_code, code = 409, "CONFLICT"


class TooManyRequests(AppError):
    status_code, code = 429, "TOO_MANY_REQUESTS"


def _body(code: str, message: str, details=None) -> dict:
    err = {"code": code, "message": message}
    if details is not None:
        err["details"] = details
    return {"success": False, "error": err}


_HTTP_CODES = {400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND",
               405: "METHOD_NOT_ALLOWED", 409: "CONFLICT", 429: "TOO_MANY_REQUESTS"}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = _HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else code
        return JSONResponse(_body(code, message), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]) or e["loc"][0], "message": e["msg"]}
                   for e in exc.errors()]
        return JSONResponse(_body("VALIDATION_ERROR", "Invalid request", details), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(_body("INTERNAL_ERROR", "Something went wrong"), status_code=500)
