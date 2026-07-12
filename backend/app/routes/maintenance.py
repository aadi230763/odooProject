"""Maintenance blueprint — Phase 8 Maintenance Workflow.

Endpoints
---------
  GET    /api/maintenance                          — list requests (filterable)
  POST   /api/maintenance                          — raise a new request (any auth)
  GET    /api/maintenance/<id>                     — get single request
  PATCH  /api/maintenance/<id>/approve             — approve (asset_manager+)
  PATCH  /api/maintenance/<id>/reject              — reject (asset_manager+)
  PATCH  /api/maintenance/<id>/assign-technician   — assign tech (asset_manager+)
  PATCH  /api/maintenance/<id>/start               — mark in-progress (any auth)
  PATCH  /api/maintenance/<id>/resolve             — resolve (any auth)
"""

from flask import Blueprint

from app.controllers import maintenance_controller
from app.middleware.auth import require_role
from app.models.employee import EmployeeRole

maintenance_bp = Blueprint("maintenance", __name__)


@maintenance_bp.get("")
@require_role()
def list_requests():
    return maintenance_controller.list_requests()


@maintenance_bp.post("")
@require_role()
def raise_request():
    return maintenance_controller.raise_request()


@maintenance_bp.get("/<int:request_id>")
@require_role()
def get_request(request_id: int):
    return maintenance_controller.get_request(request_id)


@maintenance_bp.patch("/<int:request_id>/approve")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def approve_request(request_id: int):
    return maintenance_controller.approve_request(request_id)


@maintenance_bp.patch("/<int:request_id>/reject")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def reject_request(request_id: int):
    return maintenance_controller.reject_request(request_id)


@maintenance_bp.patch("/<int:request_id>/assign-technician")
@require_role(EmployeeRole.admin, EmployeeRole.asset_manager)
def assign_technician(request_id: int):
    return maintenance_controller.assign_technician(request_id)


@maintenance_bp.patch("/<int:request_id>/start")
@require_role()
def start_progress(request_id: int):
    return maintenance_controller.start_progress(request_id)


@maintenance_bp.patch("/<int:request_id>/resolve")
@require_role()
def resolve_request(request_id: int):
    return maintenance_controller.resolve_request(request_id)
