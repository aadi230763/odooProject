"""Business logic for Resource Booking (Phase 7)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


from app.extensions import db
from app.models.asset import Asset
from app.models.booking import Booking, BookingStatus
from app.schemas.booking import (
    BookingCreateSchema,
    BookingRescheduleSchema,
)
from app.utils.activity_logger import log_activity


def _check_overlap(
    asset_id: int,
    start: datetime,
    end: datetime,
    exclude_booking_id: int | None = None,
) -> Booking | None:
    """App-level overlap check (friendly error before DB constraint)."""
    q = Booking.query.filter(
        Booking.resource_asset_id == asset_id,
        Booking.status != BookingStatus.cancelled,
        Booking.start_time < end,
        Booking.end_time > start,
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return q.first()


def create_booking(data: dict, actor_id: int) -> Booking:
    validated = BookingCreateSchema().load(data)

    asset = db.session.get(Asset, validated["resource_asset_id"])
    if not asset:
        raise ValueError("NOT_FOUND")
    if not asset.is_bookable:
        raise ValueError("NOT_BOOKABLE")

    start = validated["start_time"]
    end = validated["end_time"]

    conflict = _check_overlap(asset.id, start, end)
    if conflict:
        raise ValueError(
            f"OVERLAP: Conflicts with an existing booking "
            f"({conflict.start_time.isoformat()} – "
            f"{conflict.end_time.isoformat()})."
        )

    booking = Booking(
        resource_asset_id=asset.id,
        booked_by=actor_id,
        start_time=start,
        end_time=end,
        status=BookingStatus.upcoming,
    )
    db.session.add(booking)

    log_activity(
        actor_id=actor_id,
        action="booking_created",
        entity_type="booking",
        entity_id=None,
        metadata={
            "asset_id": asset.id,
            "asset_tag": asset.asset_tag,
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
    )
    db.session.commit()
    db.session.refresh(booking)
    return booking


def cancel_booking(booking_id: int, actor_id: int) -> Booking:
    booking = db.session.get(Booking, booking_id)
    if not booking:
        raise ValueError("NOT_FOUND")
    if booking.status in (
        BookingStatus.completed,
        BookingStatus.cancelled,
    ):
        raise ValueError(
            "INVALID_STATUS: Cannot cancel a " f"{booking.status.value} booking."
        )

    booking.status = BookingStatus.cancelled

    log_activity(
        actor_id=actor_id,
        action="booking_cancelled",
        entity_type="booking",
        entity_id=booking.id,
        metadata={"asset_id": booking.resource_asset_id},
    )
    db.session.commit()
    return booking


def reschedule_booking(booking_id: int, data: dict, actor_id: int) -> Booking:
    validated = BookingRescheduleSchema().load(data)

    booking = db.session.get(Booking, booking_id)
    if not booking:
        raise ValueError("NOT_FOUND")
    if booking.status in (
        BookingStatus.completed,
        BookingStatus.cancelled,
    ):
        raise ValueError(
            "INVALID_STATUS: Cannot reschedule a " f"{booking.status.value} booking."
        )

    new_start = validated["start_time"]
    new_end = validated["end_time"]

    conflict = _check_overlap(
        booking.resource_asset_id,
        new_start,
        new_end,
        exclude_booking_id=booking.id,
    )
    if conflict:
        raise ValueError(
            f"OVERLAP: Conflicts with an existing booking "
            f"({conflict.start_time.isoformat()} – "
            f"{conflict.end_time.isoformat()})."
        )

    booking.start_time = new_start
    booking.end_time = new_end
    # Reset to upcoming since the time changed
    booking.status = BookingStatus.upcoming

    log_activity(
        actor_id=actor_id,
        action="booking_rescheduled",
        entity_type="booking",
        entity_id=booking.id,
        metadata={
            "asset_id": booking.resource_asset_id,
            "new_start": new_start.isoformat(),
            "new_end": new_end.isoformat(),
        },
    )
    db.session.commit()
    return booking


def list_bookings(
    resource_asset_id: int | None = None,
    status: str | None = None,
    booked_by: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[Booking]:
    q = Booking.query

    if resource_asset_id:
        q = q.filter(Booking.resource_asset_id == resource_asset_id)
    if booked_by:
        q = q.filter(Booking.booked_by == booked_by)
    if status:
        try:
            q = q.filter(Booking.status == BookingStatus(status))
        except ValueError:
            pass
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            q = q.filter(Booking.start_time >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            q = q.filter(Booking.end_time <= dt)
        except ValueError:
            pass

    return q.order_by(Booking.start_time.asc()).all()


def get_bookings_for_asset(asset_id: int) -> list[Booking]:
    """Get all non-cancelled bookings for a specific asset."""
    return (
        Booking.query.filter(
            Booking.resource_asset_id == asset_id,
            Booking.status != BookingStatus.cancelled,
        )
        .order_by(Booking.start_time.asc())
        .all()
    )


def transition_booking_statuses() -> int:
    """Auto-transition upcoming→ongoing and ongoing→completed.

    Returns the count of transitioned bookings.
    """
    now = datetime.now(timezone.utc)
    count = 0

    # upcoming → ongoing
    upcoming = Booking.query.filter(
        Booking.status == BookingStatus.upcoming,
        Booking.start_time <= now,
    ).all()
    for b in upcoming:
        b.status = BookingStatus.ongoing
        count += 1

    # ongoing → completed
    ongoing = Booking.query.filter(
        Booking.status == BookingStatus.ongoing,
        Booking.end_time <= now,
    ).all()
    for b in ongoing:
        b.status = BookingStatus.completed
        count += 1

    if count:
        db.session.commit()
    return count


# ── Serialisation ───────────────────────────────────────────────────────────────


def booking_dict(b: Booking) -> dict[str, Any]:
    return {
        "id": b.id,
        "resource_asset_id": b.resource_asset_id,
        "asset_tag": (b.resource_asset.asset_tag if b.resource_asset else None),
        "asset_name": (b.resource_asset.name if b.resource_asset else None),
        "booked_by": b.booked_by,
        "booked_by_name": (b.employee.name if b.employee else None),
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status.value,
        "created_at": b.created_at.isoformat(),
        "updated_at": b.updated_at.isoformat(),
    }
