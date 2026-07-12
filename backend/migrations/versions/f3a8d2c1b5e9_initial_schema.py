"""Initial schema — all tables, enums, sequences, and integrity constraints.

Revision ID: f3a8d2c1b5e9
Revises:
Create Date: 2026-07-12

Two DB-level integrity showpieces:
  1. Partial unique index on allocations — prevents double-allocation at the DB level.
  2. EXCLUDE USING gist on bookings — prevents overlapping bookings at the DB level.
"""

from alembic import op

revision = "f3a8d2c1b5e9"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 0. Extensions
    # -------------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # -------------------------------------------------------------------------
    # 1. ENUM types  (created before any table that uses them)
    # -------------------------------------------------------------------------
    op.execute("CREATE TYPE department_status   AS ENUM ('active', 'inactive')")
    op.execute("CREATE TYPE category_status     AS ENUM ('active', 'inactive')")
    op.execute(
        "CREATE TYPE employee_role AS ENUM "
        "('admin', 'asset_manager', 'department_head', 'employee')"
    )
    op.execute("CREATE TYPE employee_status AS ENUM ('active', 'inactive')")
    op.execute(
        "CREATE TYPE asset_condition AS ENUM ('new', 'good', 'fair', 'poor')"
    )
    op.execute(
        "CREATE TYPE asset_status AS ENUM "
        "('available', 'allocated', 'reserved', 'under_maintenance', "
        " 'lost', 'retired', 'disposed')"
    )
    op.execute("CREATE TYPE document_type AS ENUM ('photo', 'document')")
    op.execute(
        "CREATE TYPE allocation_status AS ENUM ('active', 'returned', 'overdue')"
    )
    op.execute(
        "CREATE TYPE transfer_status AS ENUM "
        "('requested', 'approved', 'rejected', 'completed')"
    )
    op.execute(
        "CREATE TYPE booking_status AS ENUM "
        "('upcoming', 'ongoing', 'completed', 'cancelled')"
    )
    op.execute(
        "CREATE TYPE maintenance_priority AS ENUM "
        "('low', 'medium', 'high', 'critical')"
    )
    op.execute(
        "CREATE TYPE maintenance_status AS ENUM "
        "('pending', 'approved', 'rejected', 'technician_assigned', "
        " 'in_progress', 'resolved')"
    )
    op.execute("CREATE TYPE audit_cycle_status AS ENUM ('open', 'closed')")
    op.execute(
        "CREATE TYPE audit_item_result AS ENUM "
        "('pending', 'verified', 'missing', 'damaged')"
    )

    # -------------------------------------------------------------------------
    # 2. Sequence for auto asset tags  (AF-0001, AF-0002, …)
    # -------------------------------------------------------------------------
    op.execute("CREATE SEQUENCE asset_tag_seq START 1 INCREMENT 1")

    # -------------------------------------------------------------------------
    # 3. departments  (head_employee_id FK added later to break circular ref)
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE departments (
            id                    SERIAL PRIMARY KEY,
            name                  VARCHAR(100) NOT NULL UNIQUE,
            parent_department_id  INTEGER REFERENCES departments(id)
                                      DEFERRABLE INITIALLY DEFERRED,
            status                department_status NOT NULL DEFAULT 'active',
            created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 4. asset_categories
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE asset_categories (
            id            SERIAL PRIMARY KEY,
            name          VARCHAR(100) NOT NULL UNIQUE,
            custom_fields JSONB,
            status        category_status NOT NULL DEFAULT 'active',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 5. employees
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE employees (
            id              SERIAL PRIMARY KEY,
            name            VARCHAR(150) NOT NULL,
            email           VARCHAR(255) NOT NULL UNIQUE,
            password_hash   VARCHAR(255) NOT NULL,
            department_id   INTEGER REFERENCES departments(id),
            role            employee_role   NOT NULL DEFAULT 'employee',
            status          employee_status NOT NULL DEFAULT 'active',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 6. Resolve circular FK: departments.head_employee_id → employees
    # -------------------------------------------------------------------------
    op.execute(
        """
        ALTER TABLE departments
            ADD COLUMN head_employee_id INTEGER
                REFERENCES employees(id)
                DEFERRABLE INITIALLY DEFERRED
        """
    )

    # -------------------------------------------------------------------------
    # 7. assets  (asset_tag auto-generated from sequence)
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE assets (
            id               SERIAL PRIMARY KEY,
            asset_tag        VARCHAR(20) NOT NULL UNIQUE
                                 DEFAULT (
                                     'AF-' || LPAD(nextval('asset_tag_seq')::text, 4, '0')
                                 ),
            name             VARCHAR(200) NOT NULL,
            category_id      INTEGER NOT NULL REFERENCES asset_categories(id),
            serial_number    VARCHAR(100),
            acquisition_date DATE,
            acquisition_cost NUMERIC(12, 2),
            condition        asset_condition NOT NULL DEFAULT 'good',
            location         VARCHAR(200),
            is_bookable      BOOLEAN NOT NULL DEFAULT FALSE,
            qr_code_path     VARCHAR(500),
            status           asset_status NOT NULL DEFAULT 'available',
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 8. asset_documents
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE asset_documents (
            id         SERIAL PRIMARY KEY,
            asset_id   INTEGER NOT NULL REFERENCES assets(id),
            file_path  VARCHAR(500) NOT NULL,
            doc_type   document_type NOT NULL DEFAULT 'photo',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 9. allocations + CHECK constraint
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE allocations (
            id                      SERIAL PRIMARY KEY,
            asset_id                INTEGER NOT NULL REFERENCES assets(id),
            holder_employee_id      INTEGER REFERENCES employees(id),
            holder_department_id    INTEGER REFERENCES departments(id),
            allocated_by            INTEGER NOT NULL REFERENCES employees(id),
            expected_return_date    DATE,
            actual_return_date      DATE,
            checkin_condition_notes TEXT,
            status                  allocation_status NOT NULL DEFAULT 'active',
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_allocation_has_holder
                CHECK (
                    (holder_employee_id IS NOT NULL)
                    OR (holder_department_id IS NOT NULL)
                )
        )
        """
    )

    # =========================================================================
    # INTEGRITY SHOWPIECE #1 — No double-allocation (partial unique index)
    #
    # An asset can have at most ONE active allocation at any time.
    # A race condition cannot corrupt state — the DB enforces this even if two
    # concurrent requests both pass the app-layer check simultaneously.
    # =========================================================================
    op.execute(
        """
        CREATE UNIQUE INDEX one_active_allocation_per_asset
            ON allocations (asset_id)
            WHERE (status = 'active')
        """
    )

    # -------------------------------------------------------------------------
    # 10. transfer_requests
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE transfer_requests (
            id               SERIAL PRIMARY KEY,
            asset_id         INTEGER NOT NULL REFERENCES assets(id),
            from_employee_id INTEGER NOT NULL REFERENCES employees(id),
            to_employee_id   INTEGER NOT NULL REFERENCES employees(id),
            requested_by     INTEGER NOT NULL REFERENCES employees(id),
            approver_id      INTEGER REFERENCES employees(id),
            status           transfer_status NOT NULL DEFAULT 'requested',
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 11. bookings + CHECK constraint
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE bookings (
            id                 SERIAL PRIMARY KEY,
            resource_asset_id  INTEGER NOT NULL REFERENCES assets(id),
            booked_by          INTEGER NOT NULL REFERENCES employees(id),
            start_time         TIMESTAMPTZ NOT NULL,
            end_time           TIMESTAMPTZ NOT NULL,
            status             booking_status NOT NULL DEFAULT 'upcoming',
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_bookings_end_after_start
                CHECK (end_time > start_time)
        )
        """
    )

    # =========================================================================
    # INTEGRITY SHOWPIECE #2 — No overlapping bookings (GiST exclusion)
    #
    # Uses btree_gist to combine integer equality (same resource) with range
    # overlap (tstzrange) in a single GIST index.  Cancelled bookings are
    # excluded from the constraint so they don't block new bookings.
    # Adjacent slots (e.g. 9:00–10:00 and 10:00–11:00) are allowed because
    # tstzrange uses half-open [) bounds by default.
    # =========================================================================
    op.execute(
        """
        ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
            EXCLUDE USING gist (
                resource_asset_id WITH =,
                tstzrange(start_time, end_time) WITH &&
            ) WHERE (status <> 'cancelled'::booking_status)
        """
    )

    # -------------------------------------------------------------------------
    # 12. maintenance_requests
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE maintenance_requests (
            id            SERIAL PRIMARY KEY,
            asset_id      INTEGER NOT NULL REFERENCES assets(id),
            raised_by     INTEGER NOT NULL REFERENCES employees(id),
            description   TEXT NOT NULL,
            priority      maintenance_priority NOT NULL DEFAULT 'medium',
            photo_path    VARCHAR(500),
            approver_id   INTEGER REFERENCES employees(id),
            technician_id INTEGER REFERENCES employees(id),
            status        maintenance_status NOT NULL DEFAULT 'pending',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 13. audit_cycles
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE audit_cycles (
            id                   SERIAL PRIMARY KEY,
            name                 VARCHAR(200) NOT NULL,
            scope_department_id  INTEGER REFERENCES departments(id),
            scope_location       VARCHAR(200),
            start_date           DATE NOT NULL,
            end_date             DATE NOT NULL,
            status               audit_cycle_status NOT NULL DEFAULT 'open',
            created_by           INTEGER NOT NULL REFERENCES employees(id),
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 14. audit_assignments
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE audit_assignments (
            id                   SERIAL PRIMARY KEY,
            audit_cycle_id       INTEGER NOT NULL REFERENCES audit_cycles(id),
            auditor_employee_id  INTEGER NOT NULL REFERENCES employees(id),
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 15. audit_items
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE audit_items (
            id             SERIAL PRIMARY KEY,
            audit_cycle_id INTEGER NOT NULL REFERENCES audit_cycles(id),
            asset_id       INTEGER NOT NULL REFERENCES assets(id),
            result         audit_item_result NOT NULL DEFAULT 'pending',
            notes          TEXT,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 16. notifications  (append-only, no updated_at)
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE notifications (
            id                  SERIAL PRIMARY KEY,
            recipient_id        INTEGER NOT NULL REFERENCES employees(id),
            type                VARCHAR(80) NOT NULL,
            message             TEXT NOT NULL,
            is_read             BOOLEAN NOT NULL DEFAULT FALSE,
            related_entity_type VARCHAR(50),
            related_entity_id   INTEGER,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 17. activity_logs  (append-only, no updated_at)
    # -------------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE activity_logs (
            id          SERIAL PRIMARY KEY,
            actor_id    INTEGER REFERENCES employees(id),
            action      VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50)  NOT NULL,
            entity_id   INTEGER,
            metadata    JSONB,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -------------------------------------------------------------------------
    # 18. Performance indexes on high-traffic filter/FK columns
    # -------------------------------------------------------------------------
    op.execute("CREATE INDEX idx_assets_status       ON assets (status)")
    op.execute("CREATE INDEX idx_assets_category     ON assets (category_id)")
    op.execute("CREATE INDEX idx_alloc_asset         ON allocations (asset_id)")
    op.execute("CREATE INDEX idx_alloc_employee      ON allocations (holder_employee_id)")
    op.execute("CREATE INDEX idx_bookings_resource   ON bookings (resource_asset_id)")
    op.execute("CREATE INDEX idx_bookings_status     ON bookings (status)")
    op.execute("CREATE INDEX idx_maint_asset         ON maintenance_requests (asset_id)")
    op.execute("CREATE INDEX idx_notif_recipient     ON notifications (recipient_id, is_read)")
    op.execute("CREATE INDEX idx_actlog_entity       ON activity_logs (entity_type, entity_id)")


def downgrade() -> None:
    # Drop in reverse FK dependency order.
    op.execute("DROP TABLE IF EXISTS activity_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_items CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_assignments CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_cycles CASCADE")
    op.execute("DROP TABLE IF EXISTS maintenance_requests CASCADE")
    op.execute("DROP TABLE IF EXISTS bookings CASCADE")
    op.execute("DROP TABLE IF EXISTS transfer_requests CASCADE")
    op.execute("DROP TABLE IF EXISTS allocations CASCADE")
    op.execute("DROP TABLE IF EXISTS asset_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS assets CASCADE")
    # Resolve the circular FK before dropping employees/departments.
    op.execute("ALTER TABLE departments DROP COLUMN IF EXISTS head_employee_id")
    op.execute("DROP TABLE IF EXISTS employees CASCADE")
    op.execute("DROP TABLE IF EXISTS departments CASCADE")
    op.execute("DROP TABLE IF EXISTS asset_categories CASCADE")
    op.execute("DROP SEQUENCE IF EXISTS asset_tag_seq")
    op.execute("DROP TYPE IF EXISTS audit_item_result")
    op.execute("DROP TYPE IF EXISTS audit_cycle_status")
    op.execute("DROP TYPE IF EXISTS maintenance_status")
    op.execute("DROP TYPE IF EXISTS maintenance_priority")
    op.execute("DROP TYPE IF EXISTS booking_status")
    op.execute("DROP TYPE IF EXISTS transfer_status")
    op.execute("DROP TYPE IF EXISTS allocation_status")
    op.execute("DROP TYPE IF EXISTS document_type")
    op.execute("DROP TYPE IF EXISTS asset_status")
    op.execute("DROP TYPE IF EXISTS asset_condition")
    op.execute("DROP TYPE IF EXISTS employee_status")
    op.execute("DROP TYPE IF EXISTS employee_role")
    op.execute("DROP TYPE IF EXISTS category_status")
    op.execute("DROP TYPE IF EXISTS department_status")
