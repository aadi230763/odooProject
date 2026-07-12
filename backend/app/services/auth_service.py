"""Business logic for authentication.

Responsibilities
----------------
- signup: validate input, hash password, create Employee (always ``employee``
  role — never anything higher), generate JWT, write activity log.
- login: validate credentials, generate JWT, write activity log.
- logout: write activity log (JWT is stateless; client discards token).
- forgot_password: stub — no email delivery in this phase.
- _generate_token: build and sign the JWT payload.

The service layer never parses HTTP and never builds HTTP responses —
that belongs to the controller.  All DB writes are committed here.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from app.extensions import bcrypt, db
from app.models.employee import Employee, EmployeeRole, EmployeeStatus
from app.schemas.auth import ForgotPasswordSchema, LoginSchema, SignupSchema
from app.utils.activity_logger import log_activity


# ── Public interface ──────────────────────────────────────────────────────────


def signup(data: dict) -> tuple[Employee, str]:
    """Create a new Employee account (role always = employee).

    Args:
        data: Raw request dict (will be validated by SignupSchema).

    Returns:
        (employee, jwt_token)

    Raises:
        marshmallow.ValidationError: on bad input.
        ValueError("EMAIL_EXISTS"): if the email is already registered.
    """
    validated = SignupSchema().load(data)

    email = validated["email"].lower().strip()
    if Employee.query.filter_by(email=email).first():
        raise ValueError("EMAIL_EXISTS")

    emp = Employee(
        name=validated["name"].strip(),
        email=email,
        password_hash=bcrypt.generate_password_hash(validated["password"]).decode(
            "utf-8"
        ),
        role=EmployeeRole.employee,  # signup NEVER elevates role
        status=EmployeeStatus.active,
        department_id=validated.get("department_id"),
    )
    db.session.add(emp)
    db.session.flush()  # get emp.id before logging

    log_activity(
        actor_id=emp.id,
        action="user_signup",
        entity_type="employee",
        entity_id=emp.id,
        metadata={"email": emp.email, "role": emp.role.value},
    )
    db.session.commit()

    return emp, _generate_token(emp)


def login(data: dict) -> tuple[Employee, str]:
    """Validate credentials and return the employee + a fresh JWT.

    Raises:
        marshmallow.ValidationError: on missing/malformed fields.
        ValueError("INVALID_CREDENTIALS"): wrong email or password.
        ValueError("ACCOUNT_INACTIVE"): account is deactivated.
    """
    validated = LoginSchema().load(data)

    emp = Employee.query.filter_by(email=validated["email"].lower().strip()).first()
    if emp is None or not bcrypt.check_password_hash(
        emp.password_hash, validated["password"]
    ):
        raise ValueError("INVALID_CREDENTIALS")

    if emp.status == EmployeeStatus.inactive:
        raise ValueError("ACCOUNT_INACTIVE")

    log_activity(
        actor_id=emp.id,
        action="user_login",
        entity_type="employee",
        entity_id=emp.id,
        metadata={"email": emp.email},
    )
    db.session.commit()

    return emp, _generate_token(emp)


def logout(employee: Employee) -> None:
    """Record a logout event (JWT invalidation is client-side).

    Args:
        employee: The currently authenticated employee (from g.current_user).
    """
    log_activity(
        actor_id=employee.id,
        action="user_logout",
        entity_type="employee",
        entity_id=employee.id,
    )
    db.session.commit()


def forgot_password(data: dict) -> None:
    """Stub: validate email field; email delivery is out of scope this phase.

    Raises:
        marshmallow.ValidationError: on bad email format.
    """
    ForgotPasswordSchema().load(data)
    # TODO (Phase 12): integrate an SMTP/transactional-email provider and
    # send a signed password-reset link.  For now we always return the same
    # ambiguous success message so we don't leak whether the email exists.


# ── Private helpers ───────────────────────────────────────────────────────────


def _generate_token(emp: Employee) -> str:
    """Build and sign a JWT for the given employee."""
    cfg = current_app.config
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(emp.id),  # PyJWT 2.x requires sub to be a string
        "email": emp.email,
        "role": emp.role.value,
        "iat": now,
        "exp": now + timedelta(minutes=int(cfg["JWT_EXPIRES_MINUTES"])),
    }
    return jwt.encode(payload, cfg["JWT_SECRET"], algorithm="HS256")
