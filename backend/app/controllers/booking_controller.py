"""Booking controller — HTTP layer for Phase 7."""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app.services import booking_service
from app.utils.responses import error_response, success_response


def _flatten(messages: dict) -> dict[str, str]:
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _handle_errors(exc: ValueError):
    msg = str(exc)
    if msg == "NOT_FOUND":
        return error_response("NOT_FOUND", "Booking not found.", status=404)
    if msg == "NOT_BOOKABLE":
        return error_response(
            "NOT_BOOKABLE",
            "This asset is not marked as a bookable resource.",
            status=409,
        )
    if msg.startswith("OVERLAP"):
        return error_response("OVERLAP", msg, status=409)
    if msg.startswith("INVALID_STATUS"):
        return error_response("INVALID_STATUS", msg, status=409)
    return error_response("BAD_REQUEST", msg, status=400)


def list_bookings():
    asset_raw = request.args.get("resource_asset_id")
    asset_id = int(asset_raw) if asset_raw and asset_raw.isdigit() else None
    status = request.args.get("status") or None
    booked_by_raw = request.args.get("booked_by")
    booked_by = (
        int(booked_by_raw) if booked_by_raw and booked_by_raw.isdigit() else None
    )
    date_from = request.args.get("date_from") or None
    date_to = request.args.get("date_to") or None

    bookings = booking_service.list_bookings(
        resource_asset_id=asset_id,
        status=status,
        booked_by=booked_by,
        date_from=date_from,
        date_to=date_to,
    )
    return success_response(
        data={"bookings": [booking_service.booking_dict(b) for b in bookings]}
    )


def create_booking():
    data = request.get_json(silent=True) or {}
    try:
        booking = booking_service.create_booking(data, actor_id=g.current_user.id)
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
        data={"booking": booking_service.booking_dict(booking)},
        message="Booking created successfully.",
        status=201,
    )


def cancel_booking(booking_id: int):
    try:
        booking = booking_service.cancel_booking(booking_id, actor_id=g.current_user.id)
    except ValueError as exc:
        return _handle_errors(exc)

    return success_response(
        data={"booking": booking_service.booking_dict(booking)},
        message="Booking cancelled.",
    )


def reschedule_booking(booking_id: int):
    data = request.get_json(silent=True) or {}
    try:
        booking = booking_service.reschedule_booking(
            booking_id, data, actor_id=g.current_user.id
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
        data={"booking": booking_service.booking_dict(booking)},
        message="Booking rescheduled.",
    )


def get_asset_bookings(asset_id: int):
    bookings = booking_service.get_bookings_for_asset(asset_id)
    return success_response(
        data={"bookings": [booking_service.booking_dict(b) for b in bookings]}
    )
