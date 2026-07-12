"""SQLAlchemy model registry.

Importing this package registers all models with db.metadata, which is required
for Flask-Migrate (Alembic) to discover the schema.
"""

from app.models.activity_log import ActivityLog
from app.models.allocation import Allocation, AllocationStatus
from app.models.asset import Asset, AssetCondition, AssetStatus, VALID_TRANSITIONS
from app.models.asset_category import AssetCategory, CategoryStatus
from app.models.asset_document import AssetDocument, DocumentType
from app.models.audit import (
    AuditAssignment,
    AuditCycle,
    AuditCycleStatus,
    AuditItem,
    AuditItemResult,
)
from app.models.booking import Booking, BookingStatus
from app.models.department import Department, DepartmentStatus
from app.models.employee import Employee, EmployeeRole, EmployeeStatus
from app.models.maintenance_request import (
    MaintenancePriority,
    MaintenanceRequest,
    MaintenanceStatus,
)
from app.models.notification import Notification
from app.models.transfer_request import TransferRequest, TransferStatus

__all__ = [
    "ActivityLog",
    "Allocation",
    "AllocationStatus",
    "Asset",
    "AssetCondition",
    "AssetStatus",
    "VALID_TRANSITIONS",
    "AssetCategory",
    "CategoryStatus",
    "AssetDocument",
    "DocumentType",
    "AuditAssignment",
    "AuditCycle",
    "AuditCycleStatus",
    "AuditItem",
    "AuditItemResult",
    "Booking",
    "BookingStatus",
    "Department",
    "DepartmentStatus",
    "Employee",
    "EmployeeRole",
    "EmployeeStatus",
    "MaintenancePriority",
    "MaintenanceRequest",
    "MaintenanceStatus",
    "Notification",
    "TransferRequest",
    "TransferStatus",
]
