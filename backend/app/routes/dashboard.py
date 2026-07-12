"""Dashboard / Notifications / Activity Logs blueprint — Phase 10.

Endpoints
---------
  GET    /api/dashboard/kpis                     — live KPI snapshot
  GET    /api/notifications                      — current user's notifications
  PATCH  /api/notifications/<id>/read            — mark one read
  POST   /api/notifications/read-all             — mark all read
  GET    /api/notifications/unread-count         — badge count
  GET    /api/logs                               — activity log (admin/mgr)
"""

from flask import Blueprint

from app.controllers import dashboard_controller
from app.middleware.auth import require_role
from app.models.employee import EmployeeRole

dashboard_bp = Blueprint("dashboard", __name__)
notifications_bp = Blueprint("notifications", __name__)
logs_bp = Blueprint("logs", __name__)


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────


@dashboard_bp.get("/kpis")
@require_role()
def get_kpis():
    return dashboard_controller.get_kpis()


# ── Notifications ──────────────────────────────────────────────────────────────


@notifications_bp.get("")
@require_role()
def list_notifications():
    return dashboard_controller.list_notifications()


@notifications_bp.patch("/<int:notification_id>/read")
@require_role()
def mark_read(notification_id: int):
    return dashboard_controller.mark_notification_read(notification_id)


@notifications_bp.post("/read-all")
@require_role()
def mark_all_read():
    return dashboard_controller.mark_all_read()


@notifications_bp.get("/unread-count")
@require_role()
def unread_count():
    return dashboard_controller.get_unread_count()


# ── Activity Logs ──────────────────────────────────────────────────────────────


@logs_bp.get("")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def list_logs():
    return dashboard_controller.list_activity_logs()
