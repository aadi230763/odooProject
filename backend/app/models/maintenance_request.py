import enum

from app.extensions import db
from app.models.base import TimestampMixin


class MaintenancePriority(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MaintenanceStatus(enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    technician_assigned = "technician_assigned"
    in_progress = "in_progress"
    resolved = "resolved"


class MaintenanceRequest(db.Model, TimestampMixin):
    __tablename__ = "maintenance_requests"

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(
        db.Integer,
        db.ForeignKey("assets.id", name="fk_maintenance_requests_asset"),
        nullable=False,
    )
    raised_by = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_maintenance_requests_raised_by"),
        nullable=False,
    )
    description = db.Column(db.Text, nullable=False)
    priority = db.Column(
        db.Enum(MaintenancePriority, name="maintenance_priority"),
        nullable=False,
        default=MaintenancePriority.medium,
    )
    photo_path = db.Column(db.String(500), nullable=True)
    approver_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_maintenance_requests_approver"),
        nullable=True,
    )
    technician_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_maintenance_requests_technician"),
        nullable=True,
    )
    status = db.Column(
        db.Enum(MaintenanceStatus, name="maintenance_status"),
        nullable=False,
        default=MaintenanceStatus.pending,
    )

    asset = db.relationship("Asset", back_populates="maintenance_requests")
    raiser = db.relationship("Employee", foreign_keys=[raised_by])
    approver = db.relationship("Employee", foreign_keys=[approver_id])
    technician = db.relationship("Employee", foreign_keys=[technician_id])

    def __repr__(self) -> str:
        return f"<MaintenanceRequest asset_id={self.asset_id} status={self.status.value!r}>"  # noqa: E501
