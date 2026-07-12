"""Auth controller — request parsing and response shaping.

The controller layer:
  - Reads the raw request body (JSON).
  - Calls the service layer.
  - Catches service-level exceptions and maps them to HTTP responses.
  - Shapes the response data via the standard envelope helpers.

It never contains business logic and never touches the DB directly.
"""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app import services
from app.utils.responses import error_response, success_response


# ── Helpers ───────────────────────────────────────────────────────────────────


def _flatten_validation_errors(messages: dict) -> dict[str, str]:
    """Convert marshmallow's {field: [msg, ...]} to {field: first_msg}."""
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _employee_dict(emp) -> dict:
    """Serialise an Employee to a safe, role-agnostic dict."""
    return {
        "id": emp.id,
        "name": emp.name,
        "email": emp.email,
        "role": emp.role.value,
        "status": emp.status.value,
        "department_id": emp.department_id,
    }


# ── Controller functions ──────────────────────────────────────────────────────


def signup():
    data = request.get_json(silent=True) or {}
    try:
        emp, token = services.auth_service.signup(data)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten_validation_errors(exc.messages),
            status=400,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "EMAIL_EXISTS":
            return error_response(
                "EMAIL_EXISTS",
                "An account with this email already exists.",
                fields={"email": "Already registered."},
                status=409,
            )
        return error_response("BAD_REQUEST", code, status=400)

    return success_response(
        data={"token": token, "employee": _employee_dict(emp)},
        message="Account created successfully.",
        status=201,
    )


def login():
    data = request.get_json(silent=True) or {}
    try:
        emp, token = services.auth_service.login(data)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten_validation_errors(exc.messages),
            status=400,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "INVALID_CREDENTIALS":
            return error_response(
                "INVALID_CREDENTIALS",
                "Invalid email or password.",
                status=401,
            )
        if code == "ACCOUNT_INACTIVE":
            return error_response(
                "ACCOUNT_INACTIVE",
                "This account has been deactivated. Contact an administrator.",
                status=403,
            )
        return error_response("BAD_REQUEST", code, status=400)

    return success_response(
        data={"token": token, "employee": _employee_dict(emp)},
        message="Login successful.",
    )


def logout():
    """Log the logout action. JWT invalidation is handled client-side."""
    user = g.current_user
    services.auth_service.logout(user)
    return success_response(message="Logged out successfully.")


def me():
    """Return the currently authenticated employee's profile."""
    emp = g.current_user
    return success_response(data={"employee": _employee_dict(emp)})


def forgot_password():
    data = request.get_json(silent=True) or {}
    try:
        services.auth_service.forgot_password(data)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten_validation_errors(exc.messages),
            status=400,
        )
    # Always return the same message to avoid leaking whether the email exists.
    return success_response(
        message="If an account with that email exists, a reset link has been sent."
    )
