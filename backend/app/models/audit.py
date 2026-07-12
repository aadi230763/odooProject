import enum

from app.extensions import db
from app.models.base import TimestampMixin


class AuditCycleStatus(enum.Enum):
    open = "open"
    closed = "closed"


class AuditItemResult(enum.Enum):
    pending = "pending"
    verified = "verified"
    missing = "missing"
    damaged = "damaged"


class AuditCycle(db.Model, TimestampMixin):
    __tablename__ = "audit_cycles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    scope_department_id = db.Column(
        db.Integer,
        db.ForeignKey("departments.id", name="fk_audit_cycles_department"),
        nullable=True,
    )
    scope_location = db.Column(db.String(200), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(
        db.Enum(AuditCycleStatus, name="audit_cycle_status"),
        nullable=False,
        default=AuditCycleStatus.open,
    )
    created_by = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_audit_cycles_created_by"),
        nullable=False,
    )

    scope_department = db.relationship("Department", foreign_keys=[scope_department_id])
    creator = db.relationship("Employee", foreign_keys=[created_by])
    assignments = db.relationship(
        "AuditAssignment", back_populates="cycle", cascade="all, delete-orphan"
    )
    items = db.relationship(
        "AuditItem", back_populates="cycle", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AuditCycle {self.name!r} status={self.status.value!r}>"


class AuditAssignment(db.Model, TimestampMixin):
    __tablename__ = "audit_assignments"

    id = db.Column(db.Integer, primary_key=True)
    audit_cycle_id = db.Column(
        db.Integer,
        db.ForeignKey("audit_cycles.id", name="fk_audit_assignments_cycle"),
        nullable=False,
    )
    auditor_employee_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_audit_assignments_auditor"),
        nullable=False,
    )

    cycle = db.relationship("AuditCycle", back_populates="assignments")
    auditor = db.relationship("Employee", foreign_keys=[auditor_employee_id])

    def __repr__(self) -> str:
        return f"<AuditAssignment cycle={self.audit_cycle_id} auditor={self.auditor_employee_id}>"  # noqa: E501


class AuditItem(db.Model, TimestampMixin):
    __tablename__ = "audit_items"

    id = db.Column(db.Integer, primary_key=True)
    audit_cycle_id = db.Column(
        db.Integer,
        db.ForeignKey("audit_cycles.id", name="fk_audit_items_cycle"),
        nullable=False,
    )
    asset_id = db.Column(
        db.Integer,
        db.ForeignKey("assets.id", name="fk_audit_items_asset"),
        nullable=False,
    )
    result = db.Column(
        db.Enum(AuditItemResult, name="audit_item_result"),
        nullable=False,
        default=AuditItemResult.pending,
    )
    notes = db.Column(db.Text, nullable=True)

    cycle = db.relationship("AuditCycle", back_populates="items")
    asset = db.relationship("Asset", back_populates="audit_items")

    def __repr__(self) -> str:
        return f"<AuditItem cycle={self.audit_cycle_id} asset={self.asset_id} result={self.result.value!r}>"  # noqa: E501
