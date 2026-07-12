import enum

from app.extensions import db
from app.models.base import TimestampMixin


class DepartmentStatus(enum.Enum):
    active = "active"
    inactive = "inactive"


class Department(db.Model, TimestampMixin):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    # use_alter=True breaks the circular FK; both tables exist before this FK is added.  # noqa: E501
    head_employee_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "employees.id", name="fk_departments_head_employee", use_alter=True
        ),
        nullable=True,
    )
    parent_department_id = db.Column(
        db.Integer,
        db.ForeignKey("departments.id", name="fk_departments_parent"),
        nullable=True,
    )
    status = db.Column(
        db.Enum(DepartmentStatus, name="department_status"),
        nullable=False,
        default=DepartmentStatus.active,
    )

    # post_update=True prevents FK constraint violations during flush ordering.
    head = db.relationship(
        "Employee",
        foreign_keys=[head_employee_id],
        primaryjoin="Department.head_employee_id == Employee.id",
        post_update=True,
    )
    parent = db.relationship(
        "Department",
        remote_side=[id],
        foreign_keys=[parent_department_id],
        back_populates="children",
    )
    children = db.relationship(
        "Department",
        foreign_keys=[parent_department_id],
        back_populates="parent",
    )
    employees = db.relationship(
        "Employee",
        foreign_keys="Employee.department_id",
        back_populates="department",
    )

    def __repr__(self) -> str:
        return f"<Department {self.name!r}>"
