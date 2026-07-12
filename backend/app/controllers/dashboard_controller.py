"""Dashboard, Notifications, and Activity Logs controller (Phase 10)."""

from __future__ import annotations

from flask import g, request

from app.services import dashboard_service
from app.utils.responses import error_response, success_response


# ── Dashboard ──────────────────────────────────────────────────────────────────


def get_kpis():
    kpis = dashboard_service.get_dashboard_kpis()
    overdue = dashboard_service.get_overdue_allocations()
    upcoming = dashboard_service.get_upcoming_returns()
    return success_response(
        data={"kpis": kpis, "overdue_allocations": overdue, "upcoming_returns": upcoming}
    )


# ── Notifications ──────────────────────────────────────────────────────────────


def list_notifications():
    unread_only = request.args.get("unread_only", "").lower() in ("1", "true")
    limit_raw = request.args.get("limit", "50")
    limit = int(limit_raw) if limit_raw.isdigit() else 50

    notifs = dashboard_service.list_notifications(
        recipient_id=g.current_user.id,
        unread_only=unread_only,
        limit=limit,
    )
    count = dashboard_service.unread_count(g.current_user.id)
    return success_response(
        data={
            "notifications": [dashboard_service.notification_dict(n) for n in notifs],
            "unread_count": count,
        }
    )


def mark_notification_read(notification_id: int):
    try:
        n = dashboard_service.mark_read(notification_id, g.current_user.id)
    except ValueError:
        return error_response("NOT_FOUND", "Notification not found.", status=404)
    return success_response(
        data={"notification": dashboard_service.notification_dict(n)},
        message="Marked as read.",
    )


def mark_all_read():
    count = dashboard_service.mark_all_read(g.current_user.id)
    return success_response(
        data={"marked": count},
        message=f"{count} notification(s) marked as read.",
    )


def get_unread_count():
    count = dashboard_service.unread_count(g.current_user.id)
    return success_response(data={"unread_count": count})


# ── Activity Logs ──────────────────────────────────────────────────────────────


def list_activity_logs():
    actor_raw = request.args.get("actor_id")
    actor_id = int(actor_raw) if actor_raw and actor_raw.isdigit() else None
    entity_type = request.args.get("entity_type") or None
    action = request.args.get("action") or None
    limit_raw = request.args.get("limit", "100")
    offset_raw = request.args.get("offset", "0")
    limit = int(limit_raw) if limit_raw.isdigit() else 100
    offset = int(offset_raw) if offset_raw.isdigit() else 0

    logs, total = dashboard_service.list_activity_logs(
        actor_id=actor_id,
        entity_type=entity_type,
        action=action,
        limit=limit,
        offset=offset,
    )
    return success_response(
        data={
            "activity_logs": [dashboard_service.activity_log_dict(log) for log in logs],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )
