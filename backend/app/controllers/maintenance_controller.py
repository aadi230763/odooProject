"""Maintenance controller — HTTP layer for Phase 8."""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app.services import maintenance_service
from app.utils.responses import error_response, success_response


def _flatten(messages: dict) -> dict[str, str]:
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _handle_errors(exc: ValueError):
    msg = str(exc)
    if msg == "NOT_FOUND":
        return error_response("NOT_FOUND", "Maintenance request not found.", status=404)
    if msg == "NOT_FOUND_ASSET":
        return error_response("NOT_FOUND", "Asset not found.", status=404)
    if msg == "NOT_FOUND_TECHNICIAN":
        return error_response("NOT_FOUND", "Technician not found.", status=404)
    if msg.startswith("INVALID_STATUS"):
        return error_response("INVALID_STATUS", msg, status=409)
    if msg.startswith("INVALID_ASSET_STATUS"):
        return error_response("INVALID_ASSET_STATUS", msg, status=409)
    return error_response("BAD_REQUEST", msg, status=400)


# ── List / Detail ──────────────────────────────────────────────────────────────


def list_requests():
    asset_raw = request.args.get("asset_id")
    asset_id = int(asset_raw) if asset_raw and asset_raw.isdigit() else None
    status = request.args.get("status") or None
    raised_raw = request.args.get("raised_by")
    raised_by = int(raised_raw) if raised_raw and raised_raw.isdigit() else None
    priority = request.args.get("priority") or None

    requests = maintenance_service.list_requests(
        asset_id=asset_id,
        status=status,
        raised_by=raised_by,
        priority=priority,
    )
    return success_response(
        data={
            "maintenance_requests": [
                maintenance_service.maintenance_dict(r) for r in requests
            ]
        }
    )


def get_request(request_id: int):
    try:
        req = maintenance_service.get_request(request_id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"maintenance_request": maintenance_service.maintenance_dict(req)}
    )


# ── Raise ──────────────────────────────────────────────────────────────────────


def raise_request():
    # Support multipart/form-data (with photo) or JSON
    if request.content_type and "multipart" in request.content_type:
        data = request.form.to_dict()
        photo = request.files.get("photo")
    else:
        data = request.get_json(silent=True) or {}
        photo = None

    # asset_id might arrive as string in form data
    if "asset_id" in data and isinstance(data["asset_id"], str):
        try:
            data["asset_id"] = int(data["asset_id"])
        except ValueError:
            pass

    try:
        req = maintenance_service.raise_request(
            data, actor_id=g.current_user.id, photo=photo
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
        data={"maintenance_request": maintenance_service.maintenance_dict(req)},
        message="Maintenance request raised.",
        status=201,
    )


# ── Workflow transitions ────────────────────────────────────────────────────────


def approve_request(request_id: int):
    data = request.get_json(silent=True) or {}
    try:
        req = maintenance_service.approve_request(
            request_id, data, actor_id=g.current_user.id
        )
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Invalid input.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"maintenance_request": maintenance_service.maintenance_dict(req)},
        message="Maintenance request approved.",
    )


def reject_request(request_id: int):
    data = request.get_json(silent=True) or {}
    try:
        req = maintenance_service.reject_request(
            request_id, data, actor_id=g.current_user.id
        )
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Invalid input.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"maintenance_request": maintenance_service.maintenance_dict(req)},
        message="Maintenance request rejected.",
    )


def assign_technician(request_id: int):
    data = request.get_json(silent=True) or {}
    try:
        req = maintenance_service.assign_technician(
            request_id, data, actor_id=g.current_user.id
        )
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Invalid input.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"maintenance_request": maintenance_service.maintenance_dict(req)},
        message="Technician assigned.",
    )


def start_progress(request_id: int):
    try:
        req = maintenance_service.start_progress(request_id, actor_id=g.current_user.id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"maintenance_request": maintenance_service.maintenance_dict(req)},
        message="Maintenance marked as in progress.",
    )


def resolve_request(request_id: int):
    data = request.get_json(silent=True) or {}
    try:
        req = maintenance_service.resolve_request(
            request_id, data, actor_id=g.current_user.id
        )
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Invalid input.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(
        data={"maintenance_request": maintenance_service.maintenance_dict(req)},
        message="Maintenance request resolved. Asset is now available.",
    )
