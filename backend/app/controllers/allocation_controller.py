"""Allocation controller — HTTP layer for Phase 6."""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app.services import allocation_service
from app.utils.responses import error_response, success_response


def _flatten(messages: dict) -> dict[str, str]:
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _handle_errors(exc: ValueError):
    msg = str(exc)
    if msg == "NOT_FOUND":
        return error_response("NOT_FOUND", "Resource not found.", status=404)
    if msg == "ALREADY_ALLOCATED":
        return error_response(
            "ALREADY_ALLOCATED",
            "This asset is already allocated. " "Use a transfer request instead.",
            status=409,
        )
    if msg.startswith("INVALID_STATE"):
        return error_response("INVALID_STATE", msg, status=409)
    if msg == "MISSING_HOLDER":
        return error_response(
            "VALIDATION_ERROR",
            "Provide either holder_employee_id or " "holder_department_id.",
            status=400,
        )
    if msg == "AMBIGUOUS_HOLDER":
        return error_response(
            "VALIDATION_ERROR",
            "Provide only one of holder_employee_id or "
            "holder_department_id, not both.",
            status=400,
        )
    if msg == "HOLDER_NOT_FOUND":
        return error_response(
            "HOLDER_NOT_FOUND",
            "The specified holder does not exist.",
            status=422,
        )
    if msg == "NOT_ACTIVE":
        return error_response(
            "NOT_ACTIVE",
            "This allocation is not currently active.",
            status=409,
        )
    if msg == "NOT_ALLOCATED":
        return error_response(
            "NOT_ALLOCATED",
            "This asset has no active allocation to transfer.",
            status=409,
        )
    if msg == "RECIPIENT_NOT_FOUND":
        return error_response(
            "RECIPIENT_NOT_FOUND",
            "Target employee not found.",
            status=422,
        )
    if msg == "DEPT_TRANSFER_NOT_SUPPORTED":
        return error_response(
            "DEPT_TRANSFER_NOT_SUPPORTED",
            "Transfers are only supported for employee " "allocations.",
            status=400,
        )
    if msg == "ALREADY_PROCESSED":
        return error_response(
            "ALREADY_PROCESSED",
            "This transfer request has already been processed.",
            status=409,
        )
    return error_response("BAD_REQUEST", msg, status=400)


# ── Allocations ─────────────────────────────────────────────────────────────────


def list_allocations():
    asset_id_raw = request.args.get("asset_id")
    asset_id = int(asset_id_raw) if asset_id_raw and asset_id_raw.isdigit() else None
    status = request.args.get("status") or None
    emp_raw = request.args.get("holder_employee_id")
    emp_id = int(emp_raw) if emp_raw and emp_raw.isdigit() else None

    allocs = allocation_service.list_allocations(
        asset_id=asset_id,
        status=status,
        holder_employee_id=emp_id,
    )
    return success_response(
        data={"allocations": [allocation_service.allocation_dict(a) for a in allocs]}
    )


def create_allocation():
    data = request.get_json(silent=True) or {}
    try:
        alloc = allocation_service.allocate_asset(data, actor_id=g.current_user.id)
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
        data={"allocation": allocation_service.allocation_dict(alloc)},
        message="Asset allocated successfully.",
        status=201,
    )


def return_allocation(allocation_id: int):
    data = request.get_json(silent=True) or {}
    try:
        alloc = allocation_service.return_asset(
            allocation_id, data, actor_id=g.current_user.id
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
        data={"allocation": allocation_service.allocation_dict(alloc)},
        message="Asset returned successfully.",
    )


# ── Transfers ───────────────────────────────────────────────────────────────────


def list_transfers():
    asset_id_raw = request.args.get("asset_id")
    asset_id = int(asset_id_raw) if asset_id_raw and asset_id_raw.isdigit() else None
    status = request.args.get("status") or None

    transfers = allocation_service.list_transfers(asset_id=asset_id, status=status)
    return success_response(
        data={"transfers": [allocation_service.transfer_dict(t) for t in transfers]}
    )


def create_transfer():
    data = request.get_json(silent=True) or {}
    try:
        tr = allocation_service.create_transfer_request(
            data, actor_id=g.current_user.id
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
        data={"transfer": allocation_service.transfer_dict(tr)},
        message="Transfer request created.",
        status=201,
    )


def process_transfer(transfer_id: int):
    data = request.get_json(silent=True) or {}
    try:
        tr = allocation_service.process_transfer(
            transfer_id, data, actor_id=g.current_user.id
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
        data={"transfer": allocation_service.transfer_dict(tr)},
        message=f"Transfer {tr.status.value}.",
    )
