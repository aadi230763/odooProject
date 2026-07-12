"""Business logic for the Organization Setup module (Phase 4).

Three areas:
  1. Departments   — CRUD + status toggle
  2. AssetCategory — CRUD + status toggle
  3. Employee directory — list/get, role promotion, status toggle

Design rule: services own all DB writes and commit; controllers only parse
HTTP and shape responses.
"""

from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.asset_category import AssetCategory, CategoryStatus
from app.models.department import Department, DepartmentStatus
from app.models.employee import Employee, EmployeeRole, EmployeeStatus
from app.schemas.org import (
    CategoryCreateSchema,
    CategoryUpdateSchema,
    DepartmentCreateSchema,
    DepartmentUpdateSchema,
    EmployeeRolePromoteSchema,
    EmployeeStatusSchema,
)
from app.utils.activity_logger import log_activity


# ═══════════════════════════════════════════════════════════════════════════════
# Departments
# ═══════════════════════════════════════════════════════════════════════════════


def list_departments() -> list[Department]:
    """Return all departments ordered by name."""
    return Department.query.order_by(Department.name).all()


def get_department(dept_id: int) -> Department:
    """Fetch a department by PK.

    Raises:
        ValueError("NOT_FOUND"): if no such department.
    """
    dept = db.session.get(Department, dept_id)
    if dept is None:
        raise ValueError("NOT_FOUND")
    return dept


def create_department(data: dict, actor_id: int) -> Department:
    """Create a new department.

    Raises:
        marshmallow.ValidationError: on bad input.
        ValueError("DUPLICATE_NAME"): if the name is already taken.
        ValueError("NOT_FOUND_HEAD"): head_employee_id does not exist.
        ValueError("NOT_FOUND_PARENT"): parent_department_id does not exist.
    """
    validated = DepartmentCreateSchema().load(data)

    name = validated["name"].strip()
    if Department.query.filter_by(name=name).first():
        raise ValueError("DUPLICATE_NAME")

    # Validate FK references up-front for a friendly error.
    head_id = validated.get("head_employee_id")
    if head_id and not db.session.get(Employee, head_id):
        raise ValueError("NOT_FOUND_HEAD")

    parent_id = validated.get("parent_department_id")
    if parent_id and not db.session.get(Department, parent_id):
        raise ValueError("NOT_FOUND_PARENT")

    dept = Department(
        name=name,
        head_employee_id=head_id,
        parent_department_id=parent_id,
        status=DepartmentStatus.active,
    )
    db.session.add(dept)
    db.session.flush()

    log_activity(
        actor_id=actor_id,
        action="department_created",
        entity_type="department",
        entity_id=dept.id,
        metadata={"name": dept.name},
    )
    db.session.commit()
    return dept


def update_department(dept_id: int, data: dict, actor_id: int) -> Department:
    """Partial-update a department (PATCH semantics).

    Raises:
        marshmallow.ValidationError
        ValueError("NOT_FOUND")
        ValueError("DUPLICATE_NAME")
    """
    dept = get_department(dept_id)
    validated = DepartmentUpdateSchema().load(data)

    if "name" in validated:
        new_name = validated["name"].strip()
        conflict = Department.query.filter_by(name=new_name).first()
        if conflict and conflict.id != dept_id:
            raise ValueError("DUPLICATE_NAME")
        dept.name = new_name

    if "head_employee_id" in validated:
        head_id = validated["head_employee_id"]
        if head_id and not db.session.get(Employee, head_id):
            raise ValueError("NOT_FOUND_HEAD")
        dept.head_employee_id = head_id

    if "parent_department_id" in validated:
        parent_id = validated["parent_department_id"]
        if parent_id:
            if parent_id == dept_id:
                raise ValueError("SELF_PARENT")
            if not db.session.get(Department, parent_id):
                raise ValueError("NOT_FOUND_PARENT")
        dept.parent_department_id = parent_id

    if "status" in validated:
        dept.status = DepartmentStatus(validated["status"])

    log_activity(
        actor_id=actor_id,
        action="department_updated",
        entity_type="department",
        entity_id=dept.id,
        metadata={"changes": validated},
    )
    db.session.commit()
    return dept


def delete_department(dept_id: int, actor_id: int) -> None:
    """Deactivate (soft-delete) a department.

    Raises:
        ValueError("NOT_FOUND")
    """
    dept = get_department(dept_id)
    dept.status = DepartmentStatus.inactive
    log_activity(
        actor_id=actor_id,
        action="department_deactivated",
        entity_type="department",
        entity_id=dept.id,
    )
    db.session.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# Asset Categories
# ═══════════════════════════════════════════════════════════════════════════════


def list_categories() -> list[AssetCategory]:
    return AssetCategory.query.order_by(AssetCategory.name).all()


def get_category(cat_id: int) -> AssetCategory:
    cat = db.session.get(AssetCategory, cat_id)
    if cat is None:
        raise ValueError("NOT_FOUND")
    return cat


def create_category(data: dict, actor_id: int) -> AssetCategory:
    """Create an asset category.

    Raises:
        marshmallow.ValidationError
        ValueError("DUPLICATE_NAME")
    """
    validated = CategoryCreateSchema().load(data)

    name = validated["name"].strip()
    if AssetCategory.query.filter_by(name=name).first():
        raise ValueError("DUPLICATE_NAME")

    cat = AssetCategory(
        name=name,
        custom_fields=validated.get("custom_fields"),
        status=CategoryStatus.active,
    )
    db.session.add(cat)
    db.session.flush()

    log_activity(
        actor_id=actor_id,
        action="category_created",
        entity_type="asset_category",
        entity_id=cat.id,
        metadata={"name": cat.name},
    )
    db.session.commit()
    return cat


def update_category(cat_id: int, data: dict, actor_id: int) -> AssetCategory:
    cat = get_category(cat_id)
    validated = CategoryUpdateSchema().load(data)

    if "name" in validated:
        new_name = validated["name"].strip()
        conflict = AssetCategory.query.filter_by(name=new_name).first()
        if conflict and conflict.id != cat_id:
            raise ValueError("DUPLICATE_NAME")
        cat.name = new_name

    if "custom_fields" in validated:
        cat.custom_fields = validated["custom_fields"]

    if "status" in validated:
        cat.status = CategoryStatus(validated["status"])

    log_activity(
        actor_id=actor_id,
        action="category_updated",
        entity_type="asset_category",
        entity_id=cat.id,
        metadata={"changes": {k: str(v) for k, v in validated.items()}},
    )
    db.session.commit()
    return cat


def delete_category(cat_id: int, actor_id: int) -> None:
    cat = get_category(cat_id)
    cat.status = CategoryStatus.inactive
    log_activity(
        actor_id=actor_id,
        action="category_deactivated",
        entity_type="asset_category",
        entity_id=cat.id,
    )
    db.session.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# Employee Directory
# ═══════════════════════════════════════════════════════════════════════════════


def list_employees(
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
    department_id: int | None = None,
) -> list[Employee]:
    """List employees with optional filters."""
    q = Employee.query

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            db.or_(
                Employee.name.ilike(pattern),
                Employee.email.ilike(pattern),
            )
        )

    if role:
        try:
            q = q.filter(Employee.role == EmployeeRole(role))
        except ValueError:
            pass  # invalid enum value — ignore filter

    if status:
        try:
            q = q.filter(Employee.status == EmployeeStatus(status))
        except ValueError:
            pass

    if department_id:
        q = q.filter(Employee.department_id == department_id)

    return q.order_by(Employee.name).all()


def get_employee(emp_id: int) -> Employee:
    emp = db.session.get(Employee, emp_id)
    if emp is None:
        raise ValueError("NOT_FOUND")
    return emp


def promote_employee(emp_id: int, data: dict, actor_id: int) -> Employee:
    """Change an employee's role (Admin-only, enforced at the route layer).

    Rules:
      - An admin cannot demote themselves.
      - Role is resolved server-side — never from a JWT claim.

    Raises:
        marshmallow.ValidationError
        ValueError("NOT_FOUND")
        ValueError("SELF_DEMOTION")
    """
    emp = get_employee(emp_id)
    validated = EmployeeRolePromoteSchema().load(data)

    old_role = emp.role.value
    new_role = EmployeeRole(validated["role"])

    # Prevent an admin from removing their own admin role
    if (
        emp_id == actor_id
        and emp.role == EmployeeRole.admin
        and new_role != EmployeeRole.admin
    ):
        raise ValueError("SELF_DEMOTION")

    emp.role = new_role
    log_activity(
        actor_id=actor_id,
        action="employee_role_changed",
        entity_type="employee",
        entity_id=emp.id,
        metadata={"old_role": old_role, "new_role": new_role.value, "email": emp.email},
    )
    db.session.commit()
    return emp


def set_employee_status(emp_id: int, data: dict, actor_id: int) -> Employee:
    """Activate or deactivate an employee account.

    Raises:
        marshmallow.ValidationError
        ValueError("NOT_FOUND")
        ValueError("SELF_DEACTIVATION")
    """
    emp = get_employee(emp_id)
    validated = EmployeeStatusSchema().load(data)

    new_status = EmployeeStatus(validated["status"])
    if emp_id == actor_id and new_status == EmployeeStatus.inactive:
        raise ValueError("SELF_DEACTIVATION")

    emp.status = new_status
    log_activity(
        actor_id=actor_id,
        action="employee_status_changed",
        entity_type="employee",
        entity_id=emp.id,
        metadata={"status": new_status.value, "email": emp.email},
    )
    db.session.commit()
    return emp


# ── Serialisation helpers (used by the controller) ────────────────────────────


def dept_dict(d: Department) -> dict[str, Any]:
    return {
        "id": d.id,
        "name": d.name,
        "status": d.status.value,
        "head_employee_id": d.head_employee_id,
        "head_name": d.head.name if d.head else None,
        "parent_department_id": d.parent_department_id,
        "parent_name": d.parent.name if d.parent else None,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


def category_dict(c: AssetCategory) -> dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "status": c.status.value,
        "custom_fields": c.custom_fields or {},
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


def employee_dict(e: Employee) -> dict[str, Any]:
    return {
        "id": e.id,
        "name": e.name,
        "email": e.email,
        "role": e.role.value,
        "status": e.status.value,
        "department_id": e.department_id,
        "department_name": e.department.name if e.department else None,
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat(),
    }
