"""JWT-based authentication and RBAC middleware.

Usage
-----
Any authenticated user::

    @auth_bp.get("/me")
    @require_role()
    def me():
        emp = g.current_user   # always set when decorator passes

Specific roles only::

    @admin_bp.delete("/employees/<int:eid>")
    @require_role(EmployeeRole.admin)
    def delete_employee(eid):
        ...

Multiple allowed roles::

    @require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
    def approve_maintenance():
        ...
"""

from __future__ import annotations

import functools
import logging
from typing import Callable

import jwt
from flask import current_app, g, request

from app.extensions import db
from app.models.employee import Employee, EmployeeRole, EmployeeStatus
from app.utils.responses import error_response

logger = logging.getLogger(__name__)


def _extract_token() -> str | None:
    """Pull the Bearer token from the Authorization header, or None."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer ") and len(auth_header) > 7:
        return auth_header[7:]
    return None


def get_current_user() -> Employee | None:
    """Decode the JWT and return the matching Employee, or None on any failure.

    Failures include: missing header, expired token, tampered token,
    unknown employee ID, or a DB error.
    """
    token = _extract_token()
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET"],
            algorithms=["HS256"],
        )
        emp_id = payload.get("sub")
        if emp_id is None:
            return None
        return db.session.get(Employee, int(emp_id))  # sub stored as str (PyJWT 2.x)
    except jwt.ExpiredSignatureError:
        logger.debug("JWT expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.debug("Invalid JWT: %s", exc)
        return None


def require_role(*roles: EmployeeRole) -> Callable:
    """Decorator that enforces authentication and optional role checks.

    Args:
        *roles: Zero or more ``EmployeeRole`` values.
            - No roles  → any authenticated, active employee is permitted.
            - With roles → employee's role must be one of those given.

    Side-effect:
        Sets ``flask.g.current_user`` to the authenticated ``Employee`` so
        controllers can access it without re-decoding the token.
    """

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()

            if user is None:
                return error_response(
                    "UNAUTHORIZED",
                    "Authentication required. Provide a valid Bearer token.",
                    status=401,
                )

            if user.status == EmployeeStatus.inactive:
                return error_response(
                    "FORBIDDEN",
                    "Your account is inactive. Contact an administrator.",
                    status=403,
                )

            if roles and user.role not in roles:
                return error_response(
                    "FORBIDDEN",
                    "You do not have permission to perform this action.",
                    status=403,
                )

            g.current_user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator
