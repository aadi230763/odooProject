import enum

from app.extensions import db
from app.models.base import TimestampMixin


class EmployeeRole(enum.Enum):
    admin = "admin"
    asset_manager = "asset_manager"
    department_head = "department_head"
    employee = "employee"


class EmployeeStatus(enum.Enum):
    active = "active"
    inactive = "inactive"


class Employee(db.Model, TimestampMixin):
    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    department_id = db.Column(
        db.Integer,
        db.ForeignKey("departments.id", name="fk_employees_department"),
        nullable=True,
    )
    role = db.Column(
        db.Enum(EmployeeRole, name="employee_role"),
        nullable=False,
        default=EmployeeRole.employee,
    )
    status = db.Column(
        db.Enum(EmployeeStatus, name="employee_status"),
        nullable=False,
        default=EmployeeStatus.active,
    )

    department = db.relationship(
        "Department",
        foreign_keys=[department_id],
        back_populates="employees",
    )

    def __repr__(self) -> str:
        return f"<Employee {self.email!r} role={self.role.value!r}>"
