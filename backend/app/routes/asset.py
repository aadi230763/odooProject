"""Asset blueprint — HTTP layer for Asset Registration & Directory (Phase 5).

Endpoints
---------
  GET    /api/assets
  POST   /api/assets                 (requires asset_manager or admin)
  GET    /api/assets/<id>
  PATCH  /api/assets/<id>            (requires asset_manager or admin)
  GET    /api/assets/tag/<tag>       (QR code resolution)

  GET    /api/assets/<id>/documents
  POST   /api/assets/<id>/documents  (requires asset_manager or admin)
"""

from flask import Blueprint

from app.controllers import asset_controller
from app.middleware.auth import require_role
from app.models.employee import EmployeeRole

asset_bp = Blueprint("assets", __name__)

_admin = EmployeeRole.admin
_manager = EmployeeRole.asset_manager


@asset_bp.get("")
@require_role()  # any authenticated user
def list_assets():
    return asset_controller.list_assets()


@asset_bp.post("")
@require_role(_admin, _manager)
def create_asset():
    return asset_controller.create_asset()


@asset_bp.get("/<int:asset_id>")
@require_role()
def get_asset(asset_id: int):
    return asset_controller.get_asset(asset_id)


@asset_bp.patch("/<int:asset_id>")
@require_role(_admin, _manager)
def update_asset(asset_id: int):
    return asset_controller.update_asset(asset_id)


@asset_bp.get("/tag/<string:asset_tag>")
@require_role()
def get_asset_by_tag(asset_tag: str):
    return asset_controller.get_asset_by_tag(asset_tag)


@asset_bp.get("/<int:asset_id>/documents")
@require_role()
def get_documents(asset_id: int):
    return asset_controller.get_documents(asset_id)


@asset_bp.post("/<int:asset_id>/documents")
@require_role(_admin, _manager)
def upload_document(asset_id: int):
    return asset_controller.upload_document(asset_id)
