"""Audit controller — HTTP layer for Phase 9."""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app.services import audit_service
from app.utils.responses import error_response, success_response


def _flatten(messages: dict) -> dict[str, str]:
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _handle_errors(exc: ValueError):
    msg = str(exc)
    if msg == "NOT_FOUND":
        return error_response("NOT_FOUND", "Audit cycle not found.", status=404)
    if msg == "NOT_FOUND_ITEM":
        return error_response("NOT_FOUND", "Audit item not found.", status=404)
    if msg == "NOT_FOUND_DEPARTMENT":
        return error_response("NOT_FOUND", "Department not found.", status=404)
    if msg.startswith("NOT_FOUND_EMPLOYEE"):
        eid = msg.split(":")[-1]
        return error_response("NOT_FOUND", f"Employee {eid} not found.", status=404)
    if msg.startswith("CYCLE_CLOSED"):
        return error_response("CYCLE_CLOSED", msg, status=409)
    if msg.startswith("NOT_AUDITOR"):
        return error_response("FORBIDDEN", msg, status=403)
    return error_response("BAD_REQUEST", msg, status=400)


# ── Cycles ─────────────────────────────────────────────────────────────────────


def list_cycles():
    status = request.args.get("status") or None
    cycles = audit_service.list_cycles(status=status)
    return success_response(
        data={"audit_cycles": [audit_service.cycle_dict(c) for c in cycles]}
    )


def create_cycle():
    data = request.get_json(silent=True) or {}
    try:
        cycle = audit_service.create_cycle(data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"audit_cycle": audit_service.cycle_dict(cycle)},
        message="Audit cycle created.",
        status=201,
    )


def get_cycle(cycle_id: int):
    try:
        cycle = audit_service.get_cycle(cycle_id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(data={"audit_cycle": audit_service.cycle_dict(cycle)})


def assign_auditors(cycle_id: int):
    data = request.get_json(silent=True) or {}
    try:
        cycle = audit_service.assign_auditors(
            cycle_id, data, actor_id=g.current_user.id
        )
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"audit_cycle": audit_service.cycle_dict(cycle)},
        message="Auditors assigned.",
    )


def close_cycle(cycle_id: int):
    try:
        cycle = audit_service.close_cycle(cycle_id, actor_id=g.current_user.id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"audit_cycle": audit_service.cycle_dict(cycle)},
        message="Audit cycle closed. Missing assets have been marked Lost.",
    )


# ── Items ───────────────────────────────────────────────────────────────────────


def list_items(cycle_id: int):
    try:
        items = audit_service.list_items(cycle_id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"audit_items": [audit_service.item_dict(i) for i in items]}
    )


def mark_item(cycle_id: int, item_id: int):
    data = request.get_json(silent=True) or {}
    try:
        item = audit_service.mark_item(
            cycle_id, item_id, data, actor_id=g.current_user.id
        )
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"audit_item": audit_service.item_dict(item)},
        message="Item marked.",
    )


def discrepancy_report(cycle_id: int):
    try:
        items = audit_service.discrepancy_report(cycle_id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"discrepancies": [audit_service.item_dict(i) for i in items]}
    )
