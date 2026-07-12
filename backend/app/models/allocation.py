import enum

from sqlalchemy import CheckConstraint

from app.extensions import db
from app.models.base import TimestampMixin


class AllocationStatus(enum.Enum):
    active = "active"
    returned = "returned"
    overdue = "overdue"


class Allocation(db.Model, TimestampMixin):
    __tablename__ = "allocations"
    __table_args__ = (
        CheckConstraint(
            "(holder_employee_id IS NOT NULL) OR (holder_department_id IS NOT NULL)",
            name="chk_allocation_has_holder",
        ),
        # DB-level no-double-allocation guard is the partial unique index added in
        # the migration: CREATE UNIQUE INDEX one_active_allocation_per_asset ON
        # allocations (asset_id) WHERE (status = 'active');
    )

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(
        db.Integer,
        db.ForeignKey("assets.id", name="fk_allocations_asset"),
        nullable=False,
    )
    holder_employee_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_allocations_holder_employee"),
        nullable=True,
    )
    holder_department_id = db.Column(
        db.Integer,
        db.ForeignKey("departments.id", name="fk_allocations_holder_department"),
        nullable=True,
    )
    allocated_by = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_allocations_allocated_by"),
        nullable=False,
    )
    expected_return_date = db.Column(db.Date, nullable=True)
    actual_return_date = db.Column(db.Date, nullable=True)
    checkin_condition_notes = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.Enum(AllocationStatus, name="allocation_status"),
        nullable=False,
        default=AllocationStatus.active,
    )

    asset = db.relationship("Asset", back_populates="allocations")
    holder_employee = db.relationship("Employee", foreign_keys=[holder_employee_id])
    holder_department = db.relationship(
        "Department", foreign_keys=[holder_department_id]
    )
    allocator = db.relationship("Employee", foreign_keys=[allocated_by])

    def __repr__(self) -> str:
        return f"<Allocation asset_id={self.asset_id} status={self.status.value!r}>"
