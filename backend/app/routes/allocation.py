"""Allocation & Transfer blueprint — Phase 6.

Endpoints
---------
  GET    /api/allocations
  POST   /api/allocations                       (admin, asset_manager)
  PATCH  /api/allocations/<id>/return            (admin, asset_manager)

  GET    /api/transfers
  POST   /api/transfers                          (any authenticated)
  PATCH  /api/transfers/<id>                     (admin, asset_manager, dept_head)
"""

from flask import Blueprint

from app.controllers import allocation_controller
from app.middleware.auth import require_role
from app.models.employee import EmployeeRole

allocation_bp = Blueprint("allocations", __name__)

_admin = EmployeeRole.admin
_manager = EmployeeRole.asset_manager
_head = EmployeeRole.department_head


# ── Allocations ─────────────────────────────────────────────────────────────────


@allocation_bp.get("/allocations")
@require_role()
def list_allocations():
    return allocation_controller.list_allocations()


@allocation_bp.post("/allocations")
@require_role(_admin, _manager)
def create_allocation():
    return allocation_controller.create_allocation()


@allocation_bp.patch("/allocations/<int:allocation_id>/return")
@require_role(_admin, _manager)
def return_allocation(allocation_id: int):
    return allocation_controller.return_allocation(allocation_id)


# ── Transfers ───────────────────────────────────────────────────────────────────


@allocation_bp.get("/transfers")
@require_role()
def list_transfers():
    return allocation_controller.list_transfers()


@allocation_bp.post("/transfers")
@require_role()
def create_transfer():
    return allocation_controller.create_transfer()


@allocation_bp.patch("/transfers/<int:transfer_id>")
@require_role(_admin, _manager, _head)
def process_transfer(transfer_id: int):
    return allocation_controller.process_transfer(transfer_id)
