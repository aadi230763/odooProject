"""Activity-log writer utility.

Every state-changing action in AssetFlow must call ``log_activity``.
The entry is added to the **current DB session** — the caller is responsible
for committing (usually the service layer that owns the transaction).

Design notes
------------
- ``actor_id`` is nullable: pass ``None`` for system-initiated actions
  (e.g. scheduled overdue-flag jobs that have no human actor).
- ``metadata`` is stored as JSONB — keep values JSON-serialisable
  (str, int, float, bool, None, list, dict).
- Use ``snake_case`` verbs for ``action`` consistently so the activity-log
  view can display them uniformly, e.g. ``"asset_allocated"``,
  ``"maintenance_approved"``, ``"user_signup"``.
"""

from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.activity_log import ActivityLog


def log_activity(
    *,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> ActivityLog:
    """Append an activity-log entry to the current DB session.

    Args:
        actor_id:    Employee PK performing the action, or ``None`` for system
                     actions.
        action:      ``snake_case`` verb, e.g. ``"asset_allocated"``.
        entity_type: Domain / table name of the affected record, e.g.
                     ``"allocation"``, ``"employee"``.
        entity_id:   PK of the affected record (``None`` if not applicable).
        metadata:    JSON-serialisable dict with extra context.

    Returns:
        The unsaved ``ActivityLog`` instance (already ``db.session.add``-ed).
    """
    entry = ActivityLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        log_metadata=metadata,
    )
    db.session.add(entry)
    return entry
