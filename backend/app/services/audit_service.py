"""Business logic for Audit Cycles (Phase 9).

Workflow
--------
  1. Admin/Asset Manager creates an audit cycle (scope = dept and/or location + date range).
     In-scope assets are auto-populated as AuditItems with result=pending.
  2. Admin/Asset Manager assigns one or more auditors to the cycle.
  3. Assigned auditors mark each asset: verified | missing | damaged.
  4. Admin/Asset Manager closes the cycle:
     - Cycle is locked (status → closed); no further edits allowed.
     - missing items → asset status set to Lost.
     - Discrepancy report = all missing/damaged items (queryable).

Every write action logs to activity_logs.
"""

from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.asset import Asset, AssetStatus
from app.models.audit import (
    AuditAssignment,
    AuditCycle,
    AuditCycleStatus,
    AuditItem,
    AuditItemResult,
)
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.audit import (
    AuditAssignAuditorsSchema,
    AuditCycleCreateSchema,
    AuditItemMarkSchema,
)
from app.utils.activity_logger import log_activity


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def cycle_dict(cycle: AuditCycle) -> dict[str, Any]:
    return {
        "id": cycle.id,
        "name": cycle.name,
        "scope_department_id": cycle.scope_department_id,
        "scope_department_name": (
            cycle.scope_department.name if cycle.scope_department else None
        ),
        "scope_location": cycle.scope_location,
        "start_date": cycle.start_date.isoformat(),
        "end_date": cycle.end_date.isoformat(),
        "status": cycle.status.value,
        "created_by": cycle.created_by,
        "creator_name": cycle.creator.name if cycle.creator else None,
        "auditor_ids": [a.auditor_employee_id for a in cycle.assignments],
        "auditor_names": [a.auditor.name for a in cycle.assignments if a.auditor],
        "item_count": len(cycle.items),
        "pending_count": sum(
            1 for i in cycle.items if i.result == AuditItemResult.pending
        ),
        "verified_count": sum(
            1 for i in cycle.items if i.result == AuditItemResult.verified
        ),
        "missing_count": sum(
            1 for i in cycle.items if i.result == AuditItemResult.missing
        ),
        "damaged_count": sum(
            1 for i in cycle.items if i.result == AuditItemResult.damaged
        ),
        "created_at": cycle.created_at.isoformat(),
        "updated_at": cycle.updated_at.isoformat(),
    }


def item_dict(item: AuditItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "audit_cycle_id": item.audit_cycle_id,
        "asset_id": item.asset_id,
        "asset_tag": item.asset.asset_tag if item.asset else None,
        "asset_name": item.asset.name if item.asset else None,
        "asset_status": item.asset.status.value if item.asset else None,
        "asset_location": item.asset.location if item.asset else None,
        "result": item.result.value,
        "notes": item.notes,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Scope resolution — which assets belong to this cycle
# ---------------------------------------------------------------------------


def _resolve_scope_assets(
    scope_department_id: int | None,
    scope_location: str | None,
) -> list[Asset]:
    """Return assets matching the cycle's scope (dept OR location)."""
    q = Asset.query.filter(
        Asset.status.notin_([AssetStatus.disposed, AssetStatus.retired])
    )

    filters = []
    if scope_department_id:
        dept = db.session.get(Department, scope_department_id)
        if dept:
            filters.append(Asset.location.ilike(f"%{dept.name}%"))

    if scope_location:
        filters.append(Asset.location.ilike(f"%{scope_location}%"))

    if filters:
        q = q.filter(db.or_(*filters))

    return q.order_by(Asset.asset_tag).all()


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------


def list_cycles(status: str | None = None) -> list[AuditCycle]:
    q = AuditCycle.query
    if status:
        try:
            q = q.filter(AuditCycle.status == AuditCycleStatus(status))
        except ValueError:
            pass
    return q.order_by(AuditCycle.created_at.desc()).all()


def get_cycle(cycle_id: int) -> AuditCycle:
    cycle = db.session.get(AuditCycle, cycle_id)
    if not cycle:
        raise ValueError("NOT_FOUND")
    return cycle


def list_items(cycle_id: int) -> list[AuditItem]:
    get_cycle(cycle_id)  # raises NOT_FOUND if missing
    return (
        AuditItem.query.filter_by(audit_cycle_id=cycle_id).order_by(AuditItem.id).all()
    )


def discrepancy_report(cycle_id: int) -> list[AuditItem]:
    """Return only missing/damaged items for the cycle."""
    get_cycle(cycle_id)
    return (
        AuditItem.query.filter(
            AuditItem.audit_cycle_id == cycle_id,
            AuditItem.result.in_([AuditItemResult.missing, AuditItemResult.damaged]),
        )
        .order_by(AuditItem.id)
        .all()
    )


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------


def create_cycle(data: dict, actor_id: int) -> AuditCycle:
    validated = AuditCycleCreateSchema().load(data)

    dept_id = validated.get("scope_department_id")
    if dept_id and not db.session.get(Department, dept_id):
        raise ValueError("NOT_FOUND_DEPARTMENT")

    cycle = AuditCycle(
        name=validated["name"],
        scope_department_id=dept_id,
        scope_location=validated.get("scope_location"),
        start_date=validated["start_date"],
        end_date=validated["end_date"],
        status=AuditCycleStatus.open,
        created_by=actor_id,
    )
    db.session.add(cycle)
    db.session.flush()  # get cycle.id before populating items

    # Auto-populate in-scope assets as pending audit items
    scope_assets = _resolve_scope_assets(dept_id, validated.get("scope_location"))
    for asset in scope_assets:
        db.session.add(
            AuditItem(
                audit_cycle_id=cycle.id,
                asset_id=asset.id,
                result=AuditItemResult.pending,
            )
        )

    log_activity(
        actor_id=actor_id,
        action="audit_cycle_created",
        entity_type="audit_cycle",
        entity_id=cycle.id,
        metadata={
            "name": cycle.name,
            "asset_count": len(scope_assets),
        },
    )
    db.session.commit()
    db.session.refresh(cycle)
    return cycle


def assign_auditors(cycle_id: int, data: dict, actor_id: int) -> AuditCycle:
    """Replace the auditor list for a cycle."""
    validated = AuditAssignAuditorsSchema().load(data)

    cycle = get_cycle(cycle_id)
    if cycle.status == AuditCycleStatus.closed:
        raise ValueError("CYCLE_CLOSED: Cannot modify a closed audit cycle.")

    auditor_ids: list[int] = validated["auditor_ids"]

    # Validate all auditor IDs exist
    for eid in auditor_ids:
        if not db.session.get(Employee, eid):
            raise ValueError(f"NOT_FOUND_EMPLOYEE:{eid}")

    # Replace assignments
    AuditAssignment.query.filter_by(audit_cycle_id=cycle_id).delete()
    for eid in auditor_ids:
        db.session.add(
            AuditAssignment(audit_cycle_id=cycle_id, auditor_employee_id=eid)
        )

    log_activity(
        actor_id=actor_id,
        action="audit_auditors_assigned",
        entity_type="audit_cycle",
        entity_id=cycle_id,
        metadata={"auditor_ids": auditor_ids},
    )
    db.session.commit()
    db.session.refresh(cycle)
    return cycle


def mark_item(
    cycle_id: int,
    item_id: int,
    data: dict,
    actor_id: int,
) -> AuditItem:
    """Auditor marks a single asset item as verified/missing/damaged."""
    validated = AuditItemMarkSchema().load(data)

    cycle = get_cycle(cycle_id)
    if cycle.status == AuditCycleStatus.closed:
        raise ValueError("CYCLE_CLOSED: Cannot mark items in a closed audit cycle.")

    # Only assigned auditors (or admins/asset managers) may mark items
    is_auditor = any(a.auditor_employee_id == actor_id for a in cycle.assignments)
    if not is_auditor:
        raise ValueError(
            "NOT_AUDITOR: You are not assigned as an auditor for this cycle."
        )

    item = db.session.get(AuditItem, item_id)
    if not item or item.audit_cycle_id != cycle_id:
        raise ValueError("NOT_FOUND_ITEM")

    item.result = AuditItemResult(validated["result"])
    item.notes = validated.get("notes")

    log_activity(
        actor_id=actor_id,
        action="audit_item_marked",
        entity_type="audit_item",
        entity_id=item.id,
        metadata={
            "cycle_id": cycle_id,
            "asset_id": item.asset_id,
            "result": validated["result"],
        },
    )
    db.session.commit()
    db.session.refresh(item)
    return item


def close_cycle(cycle_id: int, actor_id: int) -> AuditCycle:
    """Close the cycle: lock it and update missing assets → Lost."""
    cycle = get_cycle(cycle_id)
    if cycle.status == AuditCycleStatus.closed:
        raise ValueError("CYCLE_CLOSED: This audit cycle is already closed.")

    missing_items = [i for i in cycle.items if i.result == AuditItemResult.missing]
    updated_assets: list[str] = []

    for item in missing_items:
        asset = item.asset
        if asset and asset.status not in (AssetStatus.disposed, AssetStatus.lost):
            asset.status = AssetStatus.lost
            updated_assets.append(asset.asset_tag)

    cycle.status = AuditCycleStatus.closed

    log_activity(
        actor_id=actor_id,
        action="audit_cycle_closed",
        entity_type="audit_cycle",
        entity_id=cycle_id,
        metadata={
            "missing_count": len(missing_items),
            "assets_marked_lost": updated_assets,
        },
    )
    db.session.commit()
    db.session.refresh(cycle)
    return cycle
