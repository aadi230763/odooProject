"""Org controller — request parsing and response shaping for Phase 4.

Covers:
  - Departments   CRUD
  - Asset Categories CRUD
  - Employee directory list/get + role promotion + status toggle
"""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app.services import org_service
from app.utils.responses import error_response, success_response


# ── Helpers ────────────────────────────────────────────────────────────────────


def _flatten(messages: dict) -> dict[str, str]:
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _handle_not_found_errors(exc: ValueError):
    """Map common ValueError codes to HTTP responses. Returns None if not matched."""
    mapping = {
        "NOT_FOUND": (404, "NOT_FOUND", "Resource not found."),
        "NOT_FOUND_HEAD": (
            422,
            "NOT_FOUND_HEAD",
            "The specified head employee does not exist.",
        ),
        "NOT_FOUND_PARENT": (
            422,
            "NOT_FOUND_PARENT",
            "The specified parent department does not exist.",
        ),
        "DUPLICATE_NAME": (
            409,
            "DUPLICATE_NAME",
            "A record with this name already exists.",
        ),
        "SELF_PARENT": (422, "SELF_PARENT", "A department cannot be its own parent."),
        "SELF_DEMOTION": (
            403,
            "SELF_DEMOTION",
            "You cannot remove your own admin role.",
        ),
        "SELF_DEACTIVATION": (
            403,
            "SELF_DEACTIVATION",
            "You cannot deactivate your own account.",
        ),
    }
    code = str(exc)
    if code in mapping:
        status, err_code, message = mapping[code]
        return error_response(err_code, message, status=status)
    return error_response("BAD_REQUEST", code, status=400)


# ═══════════════════════════════════════════════════════════════════════════════
# Departments
# ═══════════════════════════════════════════════════════════════════════════════


def list_departments():
    depts = org_service.list_departments()
    return success_response(
        data={"departments": [org_service.dept_dict(d) for d in depts]}
    )


def create_department():
    data = request.get_json(silent=True) or {}
    try:
        dept = org_service.create_department(data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(
        data={"department": org_service.dept_dict(dept)},
        message="Department created.",
        status=201,
    )


def get_department(dept_id: int):
    try:
        dept = org_service.get_department(dept_id)
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(data={"department": org_service.dept_dict(dept)})


def update_department(dept_id: int):
    data = request.get_json(silent=True) or {}
    try:
        dept = org_service.update_department(dept_id, data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(
        data={"department": org_service.dept_dict(dept)},
        message="Department updated.",
    )


def delete_department(dept_id: int):
    try:
        org_service.delete_department(dept_id, actor_id=g.current_user.id)
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(message="Department deactivated.")


# ═══════════════════════════════════════════════════════════════════════════════
# Asset Categories
# ═══════════════════════════════════════════════════════════════════════════════


def list_categories():
    cats = org_service.list_categories()
    return success_response(
        data={"categories": [org_service.category_dict(c) for c in cats]}
    )


def create_category():
    data = request.get_json(silent=True) or {}
    try:
        cat = org_service.create_category(data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(
        data={"category": org_service.category_dict(cat)},
        message="Category created.",
        status=201,
    )


def get_category(cat_id: int):
    try:
        cat = org_service.get_category(cat_id)
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(data={"category": org_service.category_dict(cat)})


def update_category(cat_id: int):
    data = request.get_json(silent=True) or {}
    try:
        cat = org_service.update_category(cat_id, data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(
        data={"category": org_service.category_dict(cat)},
        message="Category updated.",
    )


def delete_category(cat_id: int):
    try:
        org_service.delete_category(cat_id, actor_id=g.current_user.id)
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(message="Category deactivated.")


# ═══════════════════════════════════════════════════════════════════════════════
# Employee Directory
# ═══════════════════════════════════════════════════════════════════════════════


def list_employees():
    search = request.args.get("search", "").strip() or None
    role = request.args.get("role") or None
    status = request.args.get("status") or None
    dept_id_raw = request.args.get("department_id")
    dept_id = int(dept_id_raw) if dept_id_raw and dept_id_raw.isdigit() else None

    employees = org_service.list_employees(
        search=search, role=role, status=status, department_id=dept_id
    )
    return success_response(
        data={"employees": [org_service.employee_dict(e) for e in employees]}
    )


def get_employee(emp_id: int):
    try:
        emp = org_service.get_employee(emp_id)
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(data={"employee": org_service.employee_dict(emp)})


def promote_employee(emp_id: int):
    data = request.get_json(silent=True) or {}
    try:
        emp = org_service.promote_employee(emp_id, data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(
        data={"employee": org_service.employee_dict(emp)},
        message=f"Role updated to '{emp.role.value}'.",
    )


def set_employee_status(emp_id: int):
    data = request.get_json(silent=True) or {}
    try:
        emp = org_service.set_employee_status(emp_id, data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_not_found_errors(exc)
    return success_response(
        data={"employee": org_service.employee_dict(emp)},
        message=f"Employee status set to '{emp.status.value}'.",
    )
