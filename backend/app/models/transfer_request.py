import enum

from app.extensions import db
from app.models.base import TimestampMixin


class TransferStatus(enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class TransferRequest(db.Model, TimestampMixin):
    __tablename__ = "transfer_requests"

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(
        db.Integer,
        db.ForeignKey("assets.id", name="fk_transfer_requests_asset"),
        nullable=False,
    )
    from_employee_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_transfer_requests_from"),
        nullable=False,
    )
    to_employee_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_transfer_requests_to"),
        nullable=False,
    )
    requested_by = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_transfer_requests_requested_by"),
        nullable=False,
    )
    approver_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_transfer_requests_approver"),
        nullable=True,
    )
    status = db.Column(
        db.Enum(TransferStatus, name="transfer_status"),
        nullable=False,
        default=TransferStatus.requested,
    )

    asset = db.relationship("Asset", back_populates="transfer_requests")
    from_employee = db.relationship("Employee", foreign_keys=[from_employee_id])
    to_employee = db.relationship("Employee", foreign_keys=[to_employee_id])
    requester = db.relationship("Employee", foreign_keys=[requested_by])
    approver = db.relationship("Employee", foreign_keys=[approver_id])

    def __repr__(self) -> str:
        return (
            f"<TransferRequest asset_id={self.asset_id} status={self.status.value!r}>"
        )
