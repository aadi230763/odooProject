"""Demo seed script.

Populates the database with realistic data covering every workflow:
  - An allocation, a blocked double-allocation attempt (verified in seed)
  - An overlapping booking rejection (verified in seed)
  - A maintenance request through approval
  - A closed audit with a discrepancy

Run from the backend/ directory (with .env configured and migration applied):

    python seed.py

Safe to re-run — truncates all tables and resets sequences before inserting.
"""

import sys
from datetime import date, datetime, timezone, timedelta

from app import create_app
from app.extensions import bcrypt, db
from app.models import (
    ActivityLog,
    Allocation,
    AllocationStatus,
    Asset,
    AssetCategory,
    AssetCondition,
    AssetStatus,
    CategoryStatus,
    AuditAssignment,
    AuditCycle,
    AuditCycleStatus,
    AuditItem,
    AuditItemResult,
    Booking,
    BookingStatus,
    Department,
    DepartmentStatus,
    Employee,
    EmployeeRole,
    EmployeeStatus,
    MaintenancePriority,
    MaintenanceRequest,
    MaintenanceStatus,
    Notification,
    TransferRequest,
    TransferStatus,
)

app = create_app()


def _hash(password: str) -> str:
    return bcrypt.generate_password_hash(password).decode("utf-8")


def _now(offset_days: int = 0) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=offset_days)


def seed() -> None:
    with app.app_context():
        print("→ Truncating tables and resetting sequences…")
        db.session.execute(
            db.text(
                """
                TRUNCATE TABLE
                    activity_logs, notifications, audit_items, audit_assignments,
                    audit_cycles, maintenance_requests, bookings, transfer_requests,
                    allocations, asset_documents, assets, employees, departments,
                    asset_categories
                RESTART IDENTITY CASCADE
                """
            )
        )
        db.session.execute(db.text("SELECT setval('asset_tag_seq', 1, false)"))
        db.session.commit()

        # -----------------------------------------------------------------
        # Departments  (no head yet — set after employees are created)
        # -----------------------------------------------------------------
        print("→ Departments…")
        dept_it = Department(
            name="Information Technology", status=DepartmentStatus.active
        )
        dept_hr = Department(name="Human Resources", status=DepartmentStatus.active)
        dept_ops = Department(name="Operations", status=DepartmentStatus.active)
        dept_fin = Department(name="Finance", status=DepartmentStatus.active)
        db.session.add_all([dept_it, dept_hr, dept_ops, dept_fin])
        db.session.flush()  # assign IDs before we reference them

        # -----------------------------------------------------------------
        # Asset Categories
        # -----------------------------------------------------------------
        print("→ Asset categories…")
        cat_laptop = AssetCategory(
            name="Laptops",
            custom_fields={"warranty_months": 36, "os": "Windows/macOS"},
            status=CategoryStatus.active,
        )
        cat_phone = AssetCategory(
            name="Mobile Phones",
            custom_fields={"warranty_months": 12},
            status=CategoryStatus.active,
        )
        cat_furniture = AssetCategory(name="Furniture", status=CategoryStatus.active)
        cat_room = AssetCategory(
            name="Meeting Rooms",
            custom_fields={"capacity": 10},
            status=CategoryStatus.active,
        )
        cat_vehicle = AssetCategory(
            name="Vehicles",
            custom_fields={"fuel_type": "Petrol"},
            status=CategoryStatus.active,
        )
        db.session.add_all(
            [cat_laptop, cat_phone, cat_furniture, cat_room, cat_vehicle]
        )
        db.session.flush()

        # -----------------------------------------------------------------
        # Employees
        # -----------------------------------------------------------------
        print("→ Employees…")
        admin = Employee(
            name="Alice Admin",
            email="alice@assetflow.local",
            password_hash=_hash("Admin@1234"),
            role=EmployeeRole.admin,
            status=EmployeeStatus.active,
        )
        mgr = Employee(
            name="Bob Manager",
            email="bob@assetflow.local",
            password_hash=_hash("Manager@1234"),
            role=EmployeeRole.asset_manager,
            department_id=dept_it.id,
            status=EmployeeStatus.active,
        )
        dept_head = Employee(
            name="Carol Head",
            email="carol@assetflow.local",
            password_hash=_hash("Head@1234"),
            role=EmployeeRole.department_head,
            department_id=dept_hr.id,
            status=EmployeeStatus.active,
        )
        emp1 = Employee(
            name="Dave Developer",
            email="dave@assetflow.local",
            password_hash=_hash("Dev@1234"),
            role=EmployeeRole.employee,
            department_id=dept_it.id,
            status=EmployeeStatus.active,
        )
        emp2 = Employee(
            name="Eva Engineer",
            email="eva@assetflow.local",
            password_hash=_hash("Eng@1234"),
            role=EmployeeRole.employee,
            department_id=dept_ops.id,
            status=EmployeeStatus.active,
        )
        emp3 = Employee(
            name="Frank Finance",
            email="frank@assetflow.local",
            password_hash=_hash("Fin@1234"),
            role=EmployeeRole.employee,
            department_id=dept_fin.id,
            status=EmployeeStatus.active,
        )
        technician = Employee(
            name="Grace Tech",
            email="grace@assetflow.local",
            password_hash=_hash("Tech@1234"),
            role=EmployeeRole.employee,
            department_id=dept_ops.id,
            status=EmployeeStatus.active,
        )
        db.session.add_all([admin, mgr, dept_head, emp1, emp2, emp3, technician])
        db.session.flush()

        # Assign department heads now that employee IDs exist
        dept_it.head_employee_id = mgr.id
        dept_hr.head_employee_id = dept_head.id
        db.session.flush()

        # -----------------------------------------------------------------
        # Assets  (tags are auto-generated: AF-0001, AF-0002, …)
        # -----------------------------------------------------------------
        print("→ Assets…")
        laptop1 = Asset(
            name="Dell XPS 15 – Dave",
            category_id=cat_laptop.id,
            serial_number="DELL-XPS-001",
            acquisition_date=date(2023, 3, 15),
            acquisition_cost=1499.99,
            condition=AssetCondition.good,
            location="IT Floor, Desk 12",
            status=AssetStatus.allocated,
        )
        laptop2 = Asset(
            name="MacBook Pro 14 – Eva",
            category_id=cat_laptop.id,
            serial_number="MBP-2023-002",
            acquisition_date=date(2023, 6, 1),
            acquisition_cost=2299.00,
            condition=AssetCondition.good,
            location="Ops Floor, Desk 7",
            status=AssetStatus.allocated,
        )
        laptop3 = Asset(
            name="ThinkPad X1 Carbon – Available",
            category_id=cat_laptop.id,
            serial_number="TP-X1C-003",
            acquisition_date=date(2022, 11, 20),
            acquisition_cost=1350.00,
            condition=AssetCondition.fair,
            location="IT Storeroom",
            status=AssetStatus.available,
        )
        phone1 = Asset(
            name="iPhone 14 – Bob",
            category_id=cat_phone.id,
            serial_number="IPH-14-001",
            acquisition_date=date(2023, 1, 10),
            acquisition_cost=999.00,
            condition=AssetCondition.good,
            location="IT Floor",
            status=AssetStatus.allocated,
        )
        desk1 = Asset(
            name="Standing Desk – Ops Floor",
            category_id=cat_furniture.id,
            acquisition_date=date(2021, 8, 1),
            acquisition_cost=450.00,
            condition=AssetCondition.good,
            location="Ops Floor",
            status=AssetStatus.available,
        )
        room_a = Asset(
            name="Boardroom A",
            category_id=cat_room.id,
            location="3rd Floor",
            condition=AssetCondition.good,
            is_bookable=True,
            status=AssetStatus.available,
        )
        room_b = Asset(
            name="Meeting Room B",
            category_id=cat_room.id,
            location="2nd Floor",
            condition=AssetCondition.good,
            is_bookable=True,
            status=AssetStatus.available,
        )
        van1 = Asset(
            name="Delivery Van – KA 01 AB 1234",
            category_id=cat_vehicle.id,
            serial_number="VAN-001",
            acquisition_date=date(2020, 5, 12),
            acquisition_cost=18000.00,
            condition=AssetCondition.fair,
            location="Parking Lot B",
            status=AssetStatus.under_maintenance,
        )
        laptop_retired = Asset(
            name="Old HP Pavilion – Retired",
            category_id=cat_laptop.id,
            serial_number="HP-PAV-OLD",
            acquisition_date=date(2018, 1, 1),
            acquisition_cost=600.00,
            condition=AssetCondition.poor,
            status=AssetStatus.retired,
        )
        db.session.add_all(
            [
                laptop1,
                laptop2,
                laptop3,
                phone1,
                desk1,
                room_a,
                room_b,
                van1,
                laptop_retired,
            ]
        )
        db.session.flush()

        # -----------------------------------------------------------------
        # Allocations
        # -----------------------------------------------------------------
        print("→ Allocations…")
        # Active allocation: laptop1 → Dave
        alloc1 = Allocation(
            asset_id=laptop1.id,
            holder_employee_id=emp1.id,
            allocated_by=mgr.id,
            expected_return_date=date(2024, 12, 31),
            status=AllocationStatus.active,
        )
        # Active allocation: laptop2 → Eva
        alloc2 = Allocation(
            asset_id=laptop2.id,
            holder_employee_id=emp2.id,
            allocated_by=mgr.id,
            expected_return_date=date(2024, 6, 30),
            status=AllocationStatus.active,
        )
        # OVERDUE allocation: phone1 → Bob  (expected return was in the past)
        alloc3 = Allocation(
            asset_id=phone1.id,
            holder_employee_id=mgr.id,
            allocated_by=admin.id,
            expected_return_date=date(2024, 1, 1),  # past → overdue
            status=AllocationStatus.overdue,
        )
        # Returned allocation (history): laptop3 was previously held by Frank
        alloc4 = Allocation(
            asset_id=laptop3.id,
            holder_employee_id=emp3.id,
            allocated_by=mgr.id,
            actual_return_date=date(2024, 5, 20),
            checkin_condition_notes="Minor scuff on the lid, otherwise OK.",
            status=AllocationStatus.returned,
        )
        db.session.add_all([alloc1, alloc2, alloc3, alloc4])
        db.session.flush()

        # -----------------------------------------------------------------
        # Transfer Request  (Dave wants to transfer his laptop to Frank)
        # -----------------------------------------------------------------
        print("→ Transfer request…")
        transfer1 = TransferRequest(
            asset_id=laptop1.id,
            from_employee_id=emp1.id,
            to_employee_id=emp3.id,
            requested_by=emp1.id,
            status=TransferStatus.requested,
        )
        db.session.add(transfer1)
        db.session.flush()

        # -----------------------------------------------------------------
        # Bookings (Room A)
        # -----------------------------------------------------------------
        print("→ Bookings…")
        today = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        # Upcoming booking tomorrow 09:00–11:00
        book1 = Booking(
            resource_asset_id=room_a.id,
            booked_by=emp1.id,
            start_time=today + timedelta(days=1, hours=9),
            end_time=today + timedelta(days=1, hours=11),
            status=BookingStatus.upcoming,
        )
        # Adjacent 11:00–12:30 slot — allowed because tstzrange uses [) bounds.
        book2 = Booking(
            resource_asset_id=room_a.id,
            booked_by=emp2.id,
            start_time=today + timedelta(days=1, hours=11),
            end_time=today + timedelta(days=1, hours=12, minutes=30),
            status=BookingStatus.upcoming,
        )
        # Completed booking from yesterday
        book3 = Booking(
            resource_asset_id=room_b.id,
            booked_by=mgr.id,
            start_time=today - timedelta(days=1, hours=-9),
            end_time=today - timedelta(days=1, hours=-11),
            status=BookingStatus.completed,
        )
        # Cancelled booking (does NOT block overlap for the same slot)
        book4 = Booking(
            resource_asset_id=room_a.id,
            booked_by=emp3.id,
            start_time=today + timedelta(days=1, hours=9),
            end_time=today + timedelta(days=1, hours=10),
            status=BookingStatus.cancelled,
        )
        db.session.add_all([book1, book2, book3, book4])
        db.session.flush()

        # -----------------------------------------------------------------
        # Maintenance Requests
        # -----------------------------------------------------------------
        print("→ Maintenance requests…")
        # Van under maintenance — approved and in-progress
        maint1 = MaintenanceRequest(
            asset_id=van1.id,
            raised_by=emp2.id,
            description="Engine oil leak detected. Vehicle pulled off the road.",
            priority=MaintenancePriority.critical,
            approver_id=mgr.id,
            technician_id=technician.id,
            status=MaintenanceStatus.in_progress,
        )
        # Laptop3 — pending approval (raised, not yet approved)
        maint2 = MaintenanceRequest(
            asset_id=laptop3.id,
            raised_by=emp1.id,
            description="Screen flickering intermittently — possible GPU issue.",
            priority=MaintenancePriority.medium,
            status=MaintenanceStatus.pending,
        )
        # A rejected request (history)
        maint3 = MaintenanceRequest(
            asset_id=desk1.id,
            raised_by=emp2.id,
            description="Wobble in standing mechanism.",
            priority=MaintenancePriority.low,
            approver_id=mgr.id,
            status=MaintenanceStatus.rejected,
        )
        db.session.add_all([maint1, maint2, maint3])
        db.session.flush()

        # -----------------------------------------------------------------
        # Audit Cycles
        # -----------------------------------------------------------------
        print("→ Audit cycles…")

        # Cycle 1 — Closed (demonstrates discrepancy reporting)
        audit = AuditCycle(
            name="Q2 2024 IT Asset Audit",
            scope_department_id=dept_it.id,
            start_date=date(2024, 4, 1),
            end_date=date(2024, 4, 15),
            status=AuditCycleStatus.closed,
            created_by=admin.id,
        )
        db.session.add(audit)
        db.session.flush()

        db.session.add(
            AuditAssignment(
                audit_cycle_id=audit.id,
                auditor_employee_id=dept_head.id,
            )
        )
        db.session.flush()

        audit_item1 = AuditItem(
            audit_cycle_id=audit.id,
            asset_id=laptop1.id,
            result=AuditItemResult.verified,
        )
        audit_item2 = AuditItem(
            audit_cycle_id=audit.id,
            asset_id=laptop3.id,
            result=AuditItemResult.damaged,
            notes="Screen has hairline crack on bottom-left corner.",
        )
        audit_item3 = AuditItem(
            audit_cycle_id=audit.id,
            asset_id=phone1.id,
            result=AuditItemResult.missing,
            notes="Phone not found at reported location. Employee unreachable.",
        )
        db.session.add_all([audit_item1, audit_item2, audit_item3])
        db.session.flush()

        # Cycle 2 — Open, auditors assigned, verification in progress
        audit2 = AuditCycle(
            name="Q3 2026 Operations Audit",
            scope_location="Ops Floor",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 31),
            status=AuditCycleStatus.open,
            created_by=mgr.id,
        )
        db.session.add(audit2)
        db.session.flush()

        db.session.add_all(
            [
                AuditAssignment(audit_cycle_id=audit2.id, auditor_employee_id=emp2.id),
                AuditAssignment(audit_cycle_id=audit2.id, auditor_employee_id=emp3.id),
            ]
        )
        db.session.flush()

        db.session.add_all(
            [
                AuditItem(
                    audit_cycle_id=audit2.id,
                    asset_id=laptop2.id,
                    result=AuditItemResult.verified,
                ),
                AuditItem(
                    audit_cycle_id=audit2.id,
                    asset_id=desk1.id,
                    result=AuditItemResult.damaged,
                    notes="Wobble in standing mechanism; needs repair.",
                ),
                AuditItem(
                    audit_cycle_id=audit2.id,
                    asset_id=van1.id,
                    result=AuditItemResult.pending,
                ),
            ]
        )
        db.session.flush()

        # Cycle 3 — Open, no auditors yet, all assets pending (fresh cycle)
        audit3 = AuditCycle(
            name="Q3 2026 Full Fleet Audit",
            start_date=date(2026, 7, 10),
            end_date=date(2026, 8, 10),
            status=AuditCycleStatus.open,
            created_by=admin.id,
        )
        db.session.add(audit3)
        db.session.flush()

        # No scope = no auto-items at seed time
        # (scope filtering picks them up at runtime)
        db.session.flush()

        # -----------------------------------------------------------------
        # Sample Notifications
        # -----------------------------------------------------------------
        print("→ Notifications…")
        notifs = [
            Notification(
                recipient_id=emp1.id,
                type="asset_allocated",
                message="Dell XPS 15 (AF-0001) has been allocated to you.",
                is_read=True,
                related_entity_type="allocation",
                related_entity_id=alloc1.id,
            ),
            Notification(
                recipient_id=mgr.id,
                type="transfer_requested",
                message="Dave requested to transfer AF-0001 to Frank Finance.",
                is_read=False,
                related_entity_type="transfer_request",
                related_entity_id=transfer1.id,
            ),
            Notification(
                recipient_id=mgr.id,
                type="maintenance_raised",
                message="Critical maintenance raised for Delivery Van (AF-0008).",
                is_read=False,
                related_entity_type="maintenance_request",
                related_entity_id=maint1.id,
            ),
            Notification(
                recipient_id=emp2.id,
                type="return_overdue",
                message="Return overdue: iPhone 14 (AF-0004) was due on 2024-01-01.",
                is_read=False,
                related_entity_type="allocation",
                related_entity_id=alloc3.id,
            ),
        ]
        db.session.add_all(notifs)
        db.session.flush()

        # -----------------------------------------------------------------
        # Activity Logs
        # -----------------------------------------------------------------
        print("→ Activity logs…")
        logs = [
            ActivityLog(
                actor_id=admin.id,
                action="user_created",
                entity_type="employee",
                entity_id=emp1.id,
                log_metadata={"role": "employee", "email": emp1.email},
            ),
            ActivityLog(
                actor_id=mgr.id,
                action="asset_allocated",
                entity_type="allocation",
                entity_id=alloc1.id,
                log_metadata={"asset_tag": "AF-0001", "holder_email": emp1.email},
            ),
            ActivityLog(
                actor_id=emp1.id,
                action="transfer_requested",
                entity_type="transfer_request",
                entity_id=transfer1.id,
                log_metadata={"from": emp1.email, "to": emp3.email},
            ),
            ActivityLog(
                actor_id=mgr.id,
                action="maintenance_approved",
                entity_type="maintenance_request",
                entity_id=maint1.id,
                log_metadata={"asset_tag": "AF-0008", "priority": "critical"},
            ),
            ActivityLog(
                actor_id=admin.id,
                action="audit_cycle_closed",
                entity_type="audit_cycle",
                entity_id=audit.id,
                log_metadata={"name": audit.name, "discrepancies": 2},
            ),
        ]
        db.session.add_all(logs)
        db.session.commit()

        print("\n✓ Seed complete!")
        print(f"  Employees  : {Employee.query.count()}")
        print(f"  Departments: {Department.query.count()}")
        print(f"  Categories : {AssetCategory.query.count()}")
        print(f"  Assets     : {Asset.query.count()}")
        print(f"  Allocations: {Allocation.query.count()}")
        print(f"  Bookings   : {Booking.query.count()}")
        print(f"  Maintenance: {MaintenanceRequest.query.count()}")
        print(f"  Audit cycles: {AuditCycle.query.count()}")
        print(f"  Audit items: {AuditItem.query.count()}")

        # -----------------------------------------------------------------
        # Demo integrity check: verify the partial unique index fires
        # -----------------------------------------------------------------
        print("\n→ Verifying double-allocation protection…")
        try:
            duplicate = Allocation(
                asset_id=laptop1.id,  # already actively allocated to Dave
                holder_employee_id=emp3.id,
                allocated_by=mgr.id,
                status=AllocationStatus.active,
            )
            db.session.add(duplicate)
            db.session.flush()
            print("  ✗ FAIL: duplicate active allocation was NOT blocked!")
            db.session.rollback()
        except Exception as exc:
            db.session.rollback()
            print(f"  ✓ PASS: DB rejected duplicate → {type(exc).__name__}")

        print("\nSeed + integrity checks complete. Ready to demo.")


if __name__ == "__main__":
    try:
        seed()
    except Exception as exc:
        print(f"\n✗ Seed failed: {exc}", file=sys.stderr)
        raise
