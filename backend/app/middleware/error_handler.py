"""Central error-handling middleware.

Registers Flask error handlers so every uncaught exception — whether raised
deliberately (abort(403)) or accidentally (unhandled RuntimeError) — is
returned as the standard JSON envelope, never as an HTML page or stack trace.
"""

from __future__ import annotations

import logging

from flask import Flask
from werkzeug.exceptions import HTTPException

from app.utils.responses import error_response

logger = logging.getLogger(__name__)

_HTTP_ERROR_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
}


def register_error_handlers(app: Flask) -> None:
    """Attach all error handlers to the Flask application."""

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        """Convert any Werkzeug HTTPException into the standard envelope."""
        code = _HTTP_ERROR_CODES.get(exc.code or 500, "HTTP_ERROR")
        return error_response(code, exc.description or "", status=exc.code or 500)

    @app.errorhandler(Exception)
    def handle_unhandled_exception(exc: Exception):
        """Catch-all: log the traceback, return 500 without exposing internals."""
        logger.exception("Unhandled exception")
        return error_response(
            "INTERNAL_ERROR",
            "An unexpected error occurred. Please try again.",
            status=500,
        )
