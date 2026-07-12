"""Business logic for Maintenance Workflow (Phase 8).

Workflow
--------
  Pending → Approved (Asset Manager)  → asset status becomes Under Maintenance
           → Rejected (Asset Manager) → asset status unchanged

  Approved → Technician Assigned (Asset Manager)
  Technician Assigned → In Progress (Technician or Asset Manager)
  In Progress → Resolved → asset status becomes Available

Every transition writes an activity_log row.
Notifications are created for the raiser on approval/rejection/resolution.
"""

from __future__ import annotations

from typing import Any

from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.asset import Asset, AssetStatus
from app.models.employee import Employee
from app.models.maintenance_request import MaintenanceRequest, MaintenanceStatus
from app.models.notification import Notification
from app.schemas.maintenance import (
    MaintenanceApproveSchema,
    MaintenanceAssignTechnicianSchema,
    MaintenanceRaiseSchema,
    MaintenanceRejectSchema,
    MaintenanceResolveSchema,
)
from app.utils.activity_logger import log_activity
from app.utils.file_upload import save_upload


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def maintenance_dict(req: MaintenanceRequest) -> dict[str, Any]:
    return {
        "id": req.id,
        "asset_id": req.asset_id,
        "asset_tag": req.asset.asset_tag if req.asset else None,
        "asset_name": req.asset.name if req.asset else None,
        "raised_by": req.raised_by,
        "raised_by_name": req.raiser.name if req.raiser else None,
        "description": req.description,
        "priority": req.priority.value,
        "photo_path": req.photo_path,
        "approver_id": req.approver_id,
        "approver_name": req.approver.name if req.approver else None,
        "technician_id": req.technician_id,
        "technician_name": req.technician.name if req.technician else None,
        "status": req.status.value,
        "created_at": req.created_at.isoformat(),
        "updated_at": req.updated_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _save_photo(file: FileStorage) -> str:
    """Persist an uploaded maintenance photo and return its relative path."""
    return save_upload(file, subfolder="maintenance")


def _notify(recipient_id: int, type_: str, message: str, entity_id: int) -> None:
    notif = Notification(
        recipient_id=recipient_id,
        type=type_,
        message=message,
        related_entity_type="maintenance_request",
        related_entity_id=entity_id,
    )
    db.session.add(notif)


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------


def list_requests(
    asset_id: int | None = None,
    status: str | None = None,
    raised_by: int | None = None,
    priority: str | None = None,
) -> list[MaintenanceRequest]:
    q = MaintenanceRequest.query

    if asset_id:
        q = q.filter(MaintenanceRequest.asset_id == asset_id)
    if raised_by:
        q = q.filter(MaintenanceRequest.raised_by == raised_by)
    if status:
        try:
            q = q.filter(MaintenanceRequest.status == MaintenanceStatus(status))
        except ValueError:
            pass
    if priority:
        from app.models.maintenance_request import MaintenancePriority

        try:
            q = q.filter(MaintenanceRequest.priority == MaintenancePriority(priority))
        except ValueError:
            pass

    return q.order_by(MaintenanceRequest.created_at.desc()).all()


def get_request(request_id: int) -> MaintenanceRequest:
    req = db.session.get(MaintenanceRequest, request_id)
    if not req:
        raise ValueError("NOT_FOUND")
    return req


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------


def raise_request(
    data: dict,
    actor_id: int,
    photo: FileStorage | None = None,
) -> MaintenanceRequest:
    """Any authenticated user may raise a maintenance request."""
    validated = MaintenanceRaiseSchema().load(data)

    asset = db.session.get(Asset, validated["asset_id"])
    if not asset:
        raise ValueError("NOT_FOUND_ASSET")

    from app.models.maintenance_request import MaintenancePriority

    photo_path: str | None = None
    if photo:
        photo_path = _save_photo(photo)

    req = MaintenanceRequest(
        asset_id=asset.id,
        raised_by=actor_id,
        description=validated["description"],
        priority=MaintenancePriority(validated["priority"]),
        photo_path=photo_path,
        status=MaintenanceStatus.pending,
    )
    db.session.add(req)

    log_activity(
        actor_id=actor_id,
        action="maintenance_raised",
        entity_type="maintenance_request",
        entity_id=None,
        metadata={
            "asset_id": asset.id,
            "asset_tag": asset.asset_tag,
            "priority": validated["priority"],
        },
    )
    db.session.commit()
    db.session.refresh(req)
    return req


def approve_request(
    request_id: int,
    data: dict,
    actor_id: int,
) -> MaintenanceRequest:
    """Asset Manager approves → asset flips to Under Maintenance."""
    MaintenanceApproveSchema().load(data)  # validate input

    req = get_request(request_id)
    if req.status != MaintenanceStatus.pending:
        raise ValueError(
            f"INVALID_STATUS: Cannot approve a {req.status.value} request."
        )

    asset = req.asset
    if asset.status not in (
        AssetStatus.available,
        AssetStatus.allocated,
        AssetStatus.reserved,
    ):
        raise ValueError(
            f"INVALID_ASSET_STATUS: Asset is currently {asset.status.value}; "
            "cannot move it to Under Maintenance."
        )

    req.status = MaintenanceStatus.approved
    req.approver_id = actor_id
    asset.status = AssetStatus.under_maintenance

    log_activity(
        actor_id=actor_id,
        action="maintenance_approved",
        entity_type="maintenance_request",
        entity_id=req.id,
        metadata={"asset_id": asset.id, "asset_tag": asset.asset_tag},
    )
    _notify(
        recipient_id=req.raised_by,
        type_="maintenance_approved",
        message=(
            f"Your maintenance request for {asset.asset_tag} "
            f"({asset.name}) has been approved."
        ),
        entity_id=req.id,
    )
    db.session.commit()
    db.session.refresh(req)
    return req


def reject_request(
    request_id: int,
    data: dict,
    actor_id: int,
) -> MaintenanceRequest:
    """Asset Manager rejects → asset status unchanged."""
    MaintenanceRejectSchema().load(data)  # validate input

    req = get_request(request_id)
    if req.status != MaintenanceStatus.pending:
        raise ValueError(f"INVALID_STATUS: Cannot reject a {req.status.value} request.")

    req.status = MaintenanceStatus.rejected
    req.approver_id = actor_id

    log_activity(
        actor_id=actor_id,
        action="maintenance_rejected",
        entity_type="maintenance_request",
        entity_id=req.id,
        metadata={"asset_id": req.asset_id},
    )
    _notify(
        recipient_id=req.raised_by,
        type_="maintenance_rejected",
        message=(
            f"Your maintenance request for {req.asset.asset_tag} " "has been rejected."
        ),
        entity_id=req.id,
    )
    db.session.commit()
    db.session.refresh(req)
    return req


def assign_technician(
    request_id: int,
    data: dict,
    actor_id: int,
) -> MaintenanceRequest:
    """Asset Manager assigns a technician (must be an employee)."""
    validated = MaintenanceAssignTechnicianSchema().load(data)

    req = get_request(request_id)
    if req.status != MaintenanceStatus.approved:
        raise ValueError(
            "INVALID_STATUS: Can only assign a technician on an approved request "
            f"(current: {req.status.value})."
        )

    tech = db.session.get(Employee, validated["technician_id"])
    if not tech:
        raise ValueError("NOT_FOUND_TECHNICIAN")

    req.technician_id = tech.id
    req.status = MaintenanceStatus.technician_assigned

    log_activity(
        actor_id=actor_id,
        action="maintenance_technician_assigned",
        entity_type="maintenance_request",
        entity_id=req.id,
        metadata={"technician_id": tech.id, "technician_name": tech.name},
    )
    db.session.commit()
    db.session.refresh(req)
    return req


def start_progress(request_id: int, actor_id: int) -> MaintenanceRequest:
    """Move request to In Progress."""
    req = get_request(request_id)
    if req.status != MaintenanceStatus.technician_assigned:
        raise ValueError(
            "INVALID_STATUS: Request must be in 'technician_assigned' state "
            f"(current: {req.status.value})."
        )

    req.status = MaintenanceStatus.in_progress

    log_activity(
        actor_id=actor_id,
        action="maintenance_in_progress",
        entity_type="maintenance_request",
        entity_id=req.id,
        metadata={"asset_id": req.asset_id},
    )
    db.session.commit()
    db.session.refresh(req)
    return req


def resolve_request(
    request_id: int,
    data: dict,
    actor_id: int,
) -> MaintenanceRequest:
    """Resolve request → asset status flips back to Available."""
    MaintenanceResolveSchema().load(data)  # validate input

    req = get_request(request_id)
    if req.status != MaintenanceStatus.in_progress:
        raise ValueError(
            "INVALID_STATUS: Can only resolve an in-progress request "
            f"(current: {req.status.value})."
        )

    req.status = MaintenanceStatus.resolved
    req.asset.status = AssetStatus.available

    log_activity(
        actor_id=actor_id,
        action="maintenance_resolved",
        entity_type="maintenance_request",
        entity_id=req.id,
        metadata={"asset_id": req.asset_id, "asset_tag": req.asset.asset_tag},
    )
    _notify(
        recipient_id=req.raised_by,
        type_="maintenance_resolved",
        message=(
            f"Maintenance for {req.asset.asset_tag} ({req.asset.name}) "
            "has been resolved."
        ),
        entity_id=req.id,
    )
    db.session.commit()
    db.session.refresh(req)
    return req
