"""Audit Cycles blueprint — Phase 9.

Endpoints
---------
  GET    /api/audits                              — list cycles
  POST   /api/audits                              — create cycle (admin/asset_manager)
  GET    /api/audits/<id>                         — get cycle detail
  PATCH  /api/audits/<id>/assign-auditors         — assign auditors
                                                    (admin/asset_manager)
  PATCH  /api/audits/<id>/close                   — close cycle (admin/asset_manager)
  GET    /api/audits/<id>/items                   — list audit items
  PATCH  /api/audits/<id>/items/<item_id>         — mark item result (assigned auditors)
  GET    /api/audits/<id>/discrepancy-report      — discrepancy report (missing/damaged)
"""

from flask import Blueprint

from app.controllers import audit_controller
from app.middleware.auth import require_role
from app.models.employee import EmployeeRole

audit_bp = Blueprint("audits", __name__)


@audit_bp.get("")
@require_role()
def list_cycles():
    return audit_controller.list_cycles()


@audit_bp.post("")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def create_cycle():
    return audit_controller.create_cycle()


@audit_bp.get("/<int:cycle_id>")
@require_role()
def get_cycle(cycle_id: int):
    return audit_controller.get_cycle(cycle_id)


@audit_bp.patch("/<int:cycle_id>/assign-auditors")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def assign_auditors(cycle_id: int):
    return audit_controller.assign_auditors(cycle_id)


@audit_bp.patch("/<int:cycle_id>/close")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def close_cycle(cycle_id: int):
    return audit_controller.close_cycle(cycle_id)


@audit_bp.get("/<int:cycle_id>/items")
@require_role()
def list_items(cycle_id: int):
    return audit_controller.list_items(cycle_id)


@audit_bp.patch("/<int:cycle_id>/items/<int:item_id>")
@require_role()
def mark_item(cycle_id: int, item_id: int):
    return audit_controller.mark_item(cycle_id, item_id)


@audit_bp.get("/<int:cycle_id>/discrepancy-report")
@require_role()
def discrepancy_report(cycle_id: int):
    return audit_controller.discrepancy_report(cycle_id)
