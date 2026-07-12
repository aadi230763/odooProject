"""Business logic for Allocation, Transfer & Return (Phase 6)."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.extensions import db
from app.models.allocation import Allocation, AllocationStatus
from app.models.asset import Asset, AssetStatus
from app.models.employee import Employee
from app.models.department import Department
from app.models.transfer_request import TransferRequest, TransferStatus
from app.schemas.allocation import (
    AllocationCreateSchema,
    AllocationReturnSchema,
    TransferRequestCreateSchema,
    TransferActionSchema,
)
from app.utils.activity_logger import log_activity


# ── Allocation ──────────────────────────────────────────────────────────────────


def get_active_allocation(asset_id: int) -> Allocation | None:
    """Return the current active allocation for an asset, or None."""
    return Allocation.query.filter_by(
        asset_id=asset_id, status=AllocationStatus.active
    ).first()


def allocate_asset(data: dict, actor_id: int) -> Allocation:
    """Allocate an asset to an employee or department.

    Rules:
    - Asset must exist and be in 'available' status.
    - Exactly one of holder_employee_id / holder_department_id.
    - If asset is already held, raise ALREADY_ALLOCATED.
    """
    validated = AllocationCreateSchema().load(data)

    asset = db.session.get(Asset, validated["asset_id"])
    if not asset:
        raise ValueError("NOT_FOUND")

    # Check current allocation
    active = get_active_allocation(asset.id)
    if active:
        raise ValueError("ALREADY_ALLOCATED")

    if asset.status != AssetStatus.available:
        raise ValueError(
            f"INVALID_STATE: Asset is currently '{asset.status.value}', "
            f"must be 'available' to allocate."
        )

    emp_id = validated.get("holder_employee_id")
    dept_id = validated.get("holder_department_id")

    if not emp_id and not dept_id:
        raise ValueError("MISSING_HOLDER")
    if emp_id and dept_id:
        raise ValueError("AMBIGUOUS_HOLDER")

    if emp_id and not db.session.get(Employee, emp_id):
        raise ValueError("HOLDER_NOT_FOUND")
    if dept_id and not db.session.get(Department, dept_id):
        raise ValueError("HOLDER_NOT_FOUND")

    alloc = Allocation(
        asset_id=asset.id,
        holder_employee_id=emp_id,
        holder_department_id=dept_id,
        allocated_by=actor_id,
        expected_return_date=validated.get("expected_return_date"),
        status=AllocationStatus.active,
    )
    db.session.add(alloc)

    # Transition asset to allocated
    asset.status = AssetStatus.allocated

    log_activity(
        actor_id=actor_id,
        action="asset_allocated",
        entity_type="allocation",
        entity_id=None,
        metadata={
            "asset_id": asset.id,
            "asset_tag": asset.asset_tag,
            "holder_employee_id": emp_id,
            "holder_department_id": dept_id,
        },
    )
    db.session.commit()
    # Re-read to get the generated ID
    db.session.refresh(alloc)
    return alloc


def return_asset(allocation_id: int, data: dict, actor_id: int) -> Allocation:
    """Process a return for an active allocation."""
    validated = AllocationReturnSchema().load(data)

    alloc = db.session.get(Allocation, allocation_id)
    if not alloc:
        raise ValueError("NOT_FOUND")
    if alloc.status not in (AllocationStatus.active, AllocationStatus.overdue):
        raise ValueError("NOT_ACTIVE")

    alloc.status = AllocationStatus.returned
    alloc.actual_return_date = date.today()
    alloc.checkin_condition_notes = validated.get("checkin_condition_notes")

    asset = db.session.get(Asset, alloc.asset_id)
    if asset:
        asset.status = AssetStatus.available

    log_activity(
        actor_id=actor_id,
        action="asset_returned",
        entity_type="allocation",
        entity_id=alloc.id,
        metadata={
            "asset_id": alloc.asset_id,
            "notes": alloc.checkin_condition_notes,
        },
    )
    db.session.commit()
    return alloc


def list_allocations(
    asset_id: int | None = None,
    status: str | None = None,
    holder_employee_id: int | None = None,
) -> list[Allocation]:
    q = Allocation.query

    if asset_id:
        q = q.filter(Allocation.asset_id == asset_id)
    if holder_employee_id:
        q = q.filter(Allocation.holder_employee_id == holder_employee_id)
    if status:
        try:
            q = q.filter(Allocation.status == AllocationStatus(status))
        except ValueError:
            pass

    return q.order_by(Allocation.created_at.desc()).all()


def flag_overdue_allocations() -> int:
    """Flag active allocations past their expected return date.

    Returns the count of newly-flagged allocations.
    """
    today = date.today()
    overdue = Allocation.query.filter(
        Allocation.status == AllocationStatus.active,
        Allocation.expected_return_date.isnot(None),
        Allocation.expected_return_date < today,
    ).all()

    count = 0
    for alloc in overdue:
        alloc.status = AllocationStatus.overdue
        log_activity(
            actor_id=None,
            action="allocation_overdue",
            entity_type="allocation",
            entity_id=alloc.id,
            metadata={"asset_id": alloc.asset_id},
        )
        count += 1

    if count:
        db.session.commit()
    return count


# ── Transfer Requests ───────────────────────────────────────────────────────────


def create_transfer_request(data: dict, actor_id: int) -> TransferRequest:
    """Create a transfer request for a currently-allocated asset."""
    validated = TransferRequestCreateSchema().load(data)

    asset = db.session.get(Asset, validated["asset_id"])
    if not asset:
        raise ValueError("NOT_FOUND")

    active = get_active_allocation(asset.id)
    if not active:
        raise ValueError("NOT_ALLOCATED")

    to_emp = db.session.get(Employee, validated["to_employee_id"])
    if not to_emp:
        raise ValueError("RECIPIENT_NOT_FOUND")

    from_id = active.holder_employee_id
    if not from_id:
        raise ValueError("DEPT_TRANSFER_NOT_SUPPORTED")

    tr = TransferRequest(
        asset_id=asset.id,
        from_employee_id=from_id,
        to_employee_id=to_emp.id,
        requested_by=actor_id,
        status=TransferStatus.requested,
    )
    db.session.add(tr)

    log_activity(
        actor_id=actor_id,
        action="transfer_requested",
        entity_type="transfer_request",
        entity_id=None,
        metadata={
            "asset_id": asset.id,
            "from": from_id,
            "to": to_emp.id,
        },
    )
    db.session.commit()
    db.session.refresh(tr)
    return tr


def process_transfer(transfer_id: int, data: dict, actor_id: int) -> TransferRequest:
    """Approve or reject a transfer request.

    On approval the current allocation is closed and a new one is
    created for the target employee, preserving allocation history.
    """
    validated = TransferActionSchema().load(data)
    action = validated["action"]

    tr = db.session.get(TransferRequest, transfer_id)
    if not tr:
        raise ValueError("NOT_FOUND")
    if tr.status != TransferStatus.requested:
        raise ValueError("ALREADY_PROCESSED")

    tr.approver_id = actor_id

    if action == "reject":
        tr.status = TransferStatus.rejected
        log_activity(
            actor_id=actor_id,
            action="transfer_rejected",
            entity_type="transfer_request",
            entity_id=tr.id,
            metadata={"asset_id": tr.asset_id},
        )
        db.session.commit()
        return tr

    # ── Approve ─────────────────────────────────────────────
    tr.status = TransferStatus.approved

    # Close the old allocation
    old_alloc = get_active_allocation(tr.asset_id)
    if old_alloc:
        old_alloc.status = AllocationStatus.returned
        old_alloc.actual_return_date = date.today()

    # Create a new allocation for the target
    new_alloc = Allocation(
        asset_id=tr.asset_id,
        holder_employee_id=tr.to_employee_id,
        allocated_by=actor_id,
        status=AllocationStatus.active,
    )
    db.session.add(new_alloc)

    # Mark transfer as completed
    tr.status = TransferStatus.completed

    log_activity(
        actor_id=actor_id,
        action="transfer_approved",
        entity_type="transfer_request",
        entity_id=tr.id,
        metadata={
            "asset_id": tr.asset_id,
            "from": tr.from_employee_id,
            "to": tr.to_employee_id,
        },
    )
    db.session.commit()
    return tr


def list_transfers(
    asset_id: int | None = None,
    status: str | None = None,
) -> list[TransferRequest]:
    q = TransferRequest.query
    if asset_id:
        q = q.filter(TransferRequest.asset_id == asset_id)
    if status:
        try:
            q = q.filter(TransferRequest.status == TransferStatus(status))
        except ValueError:
            pass
    return q.order_by(TransferRequest.created_at.desc()).all()


# ── Serialisation helpers ───────────────────────────────────────────────────────


def allocation_dict(a: Allocation) -> dict[str, Any]:
    return {
        "id": a.id,
        "asset_id": a.asset_id,
        "asset_tag": a.asset.asset_tag if a.asset else None,
        "asset_name": a.asset.name if a.asset else None,
        "holder_employee_id": a.holder_employee_id,
        "holder_employee_name": (a.holder_employee.name if a.holder_employee else None),
        "holder_department_id": a.holder_department_id,
        "holder_department_name": (
            a.holder_department.name if a.holder_department else None
        ),
        "allocated_by": a.allocated_by,
        "allocator_name": (a.allocator.name if a.allocator else None),
        "expected_return_date": (
            a.expected_return_date.isoformat() if a.expected_return_date else None
        ),
        "actual_return_date": (
            a.actual_return_date.isoformat() if a.actual_return_date else None
        ),
        "checkin_condition_notes": a.checkin_condition_notes,
        "status": a.status.value,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


def transfer_dict(t: TransferRequest) -> dict[str, Any]:
    return {
        "id": t.id,
        "asset_id": t.asset_id,
        "asset_tag": t.asset.asset_tag if t.asset else None,
        "asset_name": t.asset.name if t.asset else None,
        "from_employee_id": t.from_employee_id,
        "from_employee_name": (t.from_employee.name if t.from_employee else None),
        "to_employee_id": t.to_employee_id,
        "to_employee_name": (t.to_employee.name if t.to_employee else None),
        "requested_by": t.requested_by,
        "requester_name": (t.requester.name if t.requester else None),
        "approver_id": t.approver_id,
        "approver_name": (t.approver.name if t.approver else None),
        "status": t.status.value,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }
