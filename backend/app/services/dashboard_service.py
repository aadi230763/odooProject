"""Dashboard, Notifications, and Activity Logs service (Phase 10)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.extensions import db
from app.models.activity_log import ActivityLog
from app.models.allocation import Allocation, AllocationStatus
from app.models.asset import Asset, AssetStatus
from app.models.booking import Booking, BookingStatus
from app.models.maintenance_request import MaintenanceRequest, MaintenanceStatus
from app.models.notification import Notification
from app.models.transfer_request import TransferRequest, TransferStatus


# ---------------------------------------------------------------------------
# KPI / Dashboard
# ---------------------------------------------------------------------------


def get_dashboard_kpis() -> dict[str, Any]:
    """Compute live KPIs from the DB for the dashboard."""
    now = datetime.now(timezone.utc)

    assets_available = Asset.query.filter_by(status=AssetStatus.available).count()
    assets_allocated = Asset.query.filter_by(status=AssetStatus.allocated).count()
    assets_reserved = Asset.query.filter_by(status=AssetStatus.reserved).count()
    assets_maintenance = Asset.query.filter_by(
        status=AssetStatus.under_maintenance
    ).count()
    assets_total = Asset.query.filter(
        Asset.status.notin_([AssetStatus.disposed, AssetStatus.retired])
    ).count()

    active_bookings = Booking.query.filter(
        Booking.status.in_([BookingStatus.upcoming, BookingStatus.ongoing])
    ).count()

    pending_transfers = TransferRequest.query.filter_by(
        status=TransferStatus.requested
    ).count()

    overdue_allocations = Allocation.query.filter_by(
        status=AllocationStatus.overdue
    ).count()

    pending_maintenance = MaintenanceRequest.query.filter_by(
        status=MaintenanceStatus.pending
    ).count()

    # Upcoming allocations with expected_return_date in the next 7 days
    from datetime import timedelta
    from sqlalchemy import and_
    upcoming_returns = Allocation.query.filter(
        and_(
            Allocation.status == AllocationStatus.active,
            Allocation.expected_return_date.isnot(None),
            Allocation.expected_return_date
            <= (now + timedelta(days=7)).date(),
        )
    ).count()

    return {
        "assets_available": assets_available,
        "assets_allocated": assets_allocated,
        "assets_reserved": assets_reserved,
        "assets_maintenance": assets_maintenance,
        "assets_total": assets_total,
        "active_bookings": active_bookings,
        "pending_transfers": pending_transfers,
        "overdue_allocations": overdue_allocations,
        "pending_maintenance": pending_maintenance,
        "upcoming_returns": upcoming_returns,
    }


def get_overdue_allocations(limit: int = 10) -> list[dict[str, Any]]:
    rows = (
        Allocation.query.filter_by(status=AllocationStatus.overdue)
        .order_by(Allocation.expected_return_date.asc())
        .limit(limit)
        .all()
    )
    return [_alloc_dict(a) for a in rows]


def get_upcoming_returns(limit: int = 10) -> list[dict[str, Any]]:
    from datetime import timedelta
    from sqlalchemy import and_
    now = datetime.now(timezone.utc)
    rows = (
        Allocation.query.filter(
            and_(
                Allocation.status == AllocationStatus.active,
                Allocation.expected_return_date.isnot(None),
                Allocation.expected_return_date
                <= (now + timedelta(days=7)).date(),
            )
        )
        .order_by(Allocation.expected_return_date.asc())
        .limit(limit)
        .all()
    )
    return [_alloc_dict(a) for a in rows]


def _alloc_dict(a: Allocation) -> dict[str, Any]:
    return {
        "id": a.id,
        "asset_id": a.asset_id,
        "asset_tag": a.asset.asset_tag if a.asset else None,
        "asset_name": a.asset.name if a.asset else None,
        "holder_name": (
            a.holder_employee.name
            if a.holder_employee
            else (a.holder_department.name if a.holder_department else None)
        ),
        "expected_return_date": (
            a.expected_return_date.isoformat() if a.expected_return_date else None
        ),
        "status": a.status.value,
    }


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


def list_notifications(
    recipient_id: int,
    unread_only: bool = False,
    limit: int = 50,
) -> list[Notification]:
    q = Notification.query.filter_by(recipient_id=recipient_id)
    if unread_only:
        q = q.filter_by(is_read=False)
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


def mark_read(notification_id: int, recipient_id: int) -> Notification:
    n = db.session.get(Notification, notification_id)
    if not n or n.recipient_id != recipient_id:
        raise ValueError("NOT_FOUND")
    n.is_read = True
    db.session.commit()
    return n


def mark_all_read(recipient_id: int) -> int:
    count = Notification.query.filter_by(
        recipient_id=recipient_id, is_read=False
    ).update({"is_read": True})
    db.session.commit()
    return count


def unread_count(recipient_id: int) -> int:
    return Notification.query.filter_by(
        recipient_id=recipient_id, is_read=False
    ).count()


def notification_dict(n: Notification) -> dict[str, Any]:
    return {
        "id": n.id,
        "type": n.type,
        "message": n.message,
        "is_read": n.is_read,
        "related_entity_type": n.related_entity_type,
        "related_entity_id": n.related_entity_id,
        "created_at": n.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Activity Logs
# ---------------------------------------------------------------------------


def list_activity_logs(
    actor_id: int | None = None,
    entity_type: str | None = None,
    action: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[ActivityLog], int]:
    q = ActivityLog.query
    if actor_id:
        q = q.filter_by(actor_id=actor_id)
    if entity_type:
        q = q.filter_by(entity_type=entity_type)
    if action:
        q = q.filter(ActivityLog.action.ilike(f"%{action}%"))

    total = q.count()
    rows = (
        q.order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return rows, total


def activity_log_dict(log: ActivityLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "actor_id": log.actor_id,
        "actor_name": log.actor.name if log.actor else "System",
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "metadata": log.log_metadata,
        "created_at": log.created_at.isoformat(),
    }
