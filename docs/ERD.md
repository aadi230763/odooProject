# AssetFlow — Entity Relationship Diagram & Schema Reference

## Entity Relationship Overview

```
departments ──────────────────────────────────────┐
  id (PK)                                          │
  name                                             │
  head_employee_id (FK → employees)  [use_alter]  │
  parent_department_id (FK → self)                 │
  status: active | inactive                        │
                                                   │
asset_categories                                   │
  id (PK)                                          │
  name                                             │
  custom_fields (JSONB)                            │
  status: active | inactive                        │
                                                   ▼
employees ◄──────────── departments.head_employee_id
  id (PK)
  name
  email (UNIQUE)
  password_hash
  department_id (FK → departments)
  role: admin | asset_manager | department_head | employee
  status: active | inactive

assets
  id (PK)
  asset_tag (UNIQUE, auto AF-0001 via asset_tag_seq)
  name
  category_id (FK → asset_categories)
  serial_number
  acquisition_date
  acquisition_cost (NUMERIC 12,2 — reporting only, no financial logic)
  condition: new | good | fair | poor
  location
  is_bookable (BOOLEAN)
  qr_code_path
  status: available | allocated | reserved | under_maintenance | lost | retired | disposed

asset_documents
  id (PK)
  asset_id (FK → assets)
  file_path
  doc_type: photo | document

allocations ← INTEGRITY SHOWPIECE #1
  id (PK)
  asset_id (FK → assets)
  holder_employee_id (FK → employees, nullable)
  holder_department_id (FK → departments, nullable)
  allocated_by (FK → employees)
  expected_return_date
  actual_return_date
  checkin_condition_notes
  status: active | returned | overdue
  CHECK: (holder_employee_id IS NOT NULL) OR (holder_department_id IS NOT NULL)
  ★ UNIQUE INDEX one_active_allocation_per_asset
       ON allocations (asset_id) WHERE (status = 'active')

transfer_requests
  id (PK)
  asset_id (FK → assets)
  from_employee_id (FK → employees)
  to_employee_id (FK → employees)
  requested_by (FK → employees)
  approver_id (FK → employees, nullable)
  status: requested | approved | rejected | completed

bookings ← INTEGRITY SHOWPIECE #2
  id (PK)
  resource_asset_id (FK → assets — must have is_bookable=TRUE)
  booked_by (FK → employees)
  start_time (TIMESTAMPTZ)
  end_time (TIMESTAMPTZ)
  status: upcoming | ongoing | completed | cancelled
  CHECK: end_time > start_time
  ★ EXCLUDE USING gist (
        resource_asset_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status::text <> 'cancelled')

maintenance_requests
  id (PK)
  asset_id (FK → assets)
  raised_by (FK → employees)
  description
  priority: low | medium | high | critical
  photo_path
  approver_id (FK → employees, nullable)
  technician_id (FK → employees, nullable)
  status: pending | approved | rejected | technician_assigned | in_progress | resolved

audit_cycles
  id (PK)
  name
  scope_department_id (FK → departments, nullable)
  scope_location (nullable)
  start_date
  end_date
  status: open | closed
  created_by (FK → employees)

audit_assignments
  id (PK)
  audit_cycle_id (FK → audit_cycles)
  auditor_employee_id (FK → employees)

audit_items
  id (PK)
  audit_cycle_id (FK → audit_cycles)
  asset_id (FK → assets)
  result: pending | verified | missing | damaged
  notes

notifications
  id (PK)
  recipient_id (FK → employees)
  type (VARCHAR 80)
  message
  is_read (BOOLEAN)
  related_entity_type
  related_entity_id
  created_at

activity_logs
  id (PK)
  actor_id (FK → employees, nullable — system actions have no actor)
  action (VARCHAR 100)
  entity_type (VARCHAR 50)
  entity_id
  metadata (JSONB)
  created_at
```

---

## Two DB-Level Integrity Showpieces

### Showpiece 1 — No Double-Allocation (Partial Unique Index)

```sql
CREATE UNIQUE INDEX one_active_allocation_per_asset
    ON allocations (asset_id)
    WHERE (status = 'active');
```

**Why this matters:** Without this index, two concurrent requests could both
pass the app-level "is this asset currently allocated?" check and both commit,
creating two active allocations for one asset. The partial unique index makes
that impossible at the database level regardless of timing.

**Demo it:** Try inserting a second `active` allocation for any asset that
already has one — PostgreSQL rejects it with a unique constraint violation even
if the app layer is bypassed entirely.

### Showpiece 2 — No Overlapping Bookings (GiST Exclusion)

```sql
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        resource_asset_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status::text <> 'cancelled');
```

**Why this matters:** A standard unique index can't encode "same resource AND
overlapping time range". The GiST exclusion constraint (enabled by
`btree_gist`) can. It checks: for the same `resource_asset_id`, no two
non-cancelled bookings may have overlapping time ranges.

**Adjacent slots are allowed:** `tstzrange` uses half-open `[)` bounds, so
`[09:00, 10:00)` and `[10:00, 11:00)` do not overlap — back-to-back bookings
are valid.

**Cancelled bookings are excluded:** The `WHERE (status <> 'cancelled')`
predicate means cancelled bookings never block new ones for the same slot.

**Requires:** `CREATE EXTENSION IF NOT EXISTS btree_gist` (in the migration).

---

## Enum Reference

| Type | Values |
|---|---|
| `department_status` | active, inactive |
| `category_status` | active, inactive |
| `employee_role` | admin, asset_manager, department_head, employee |
| `employee_status` | active, inactive |
| `asset_condition` | new, good, fair, poor |
| `asset_status` | available, allocated, reserved, under_maintenance, lost, retired, disposed |
| `document_type` | photo, document |
| `allocation_status` | active, returned, overdue |
| `transfer_status` | requested, approved, rejected, completed |
| `booking_status` | upcoming, ongoing, completed, cancelled |
| `maintenance_priority` | low, medium, high, critical |
| `maintenance_status` | pending, approved, rejected, technician_assigned, in_progress, resolved |
| `audit_cycle_status` | open, closed |
| `audit_item_result` | pending, verified, missing, damaged |

---

## Asset Lifecycle State Machine

```
                  ┌─────────────┐
         ┌───────►│  Available  │◄──────────────────┐
         │        └──────┬──────┘                   │
         │               │ allocate / reserve        │
         │               ▼                           │
         │        ┌─────────────┐                    │
         │        │  Allocated  │── return ──────────┤
         │        └──────┬──────┘                    │
         │               │ flag lost                 │
         │               ▼                           │
         │           ┌────────┐                      │
         │           │  Lost  │── found ─────────────┘
         │           └───┬────┘
         │               │ write off
         │               ▼
         │  ┌────────────────────┐   resolve   ┌──────────────────┐
         │  │ Under Maintenance  │────────────►│    Available     │
         │  └────────────────────┘             └──────────────────┘
         │               │ retire
         │               ▼
         │         ┌──────────┐
         └────────►│ Retired  │── dispose ──► Disposed (terminal)
                   └──────────┘
```

Valid transitions are enforced by the `VALID_TRANSITIONS` dict in
[asset.py](../backend/app/models/asset.py) (service layer will enforce in
Phase 5).
