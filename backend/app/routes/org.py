"""Org blueprint — thin HTTP layer for Organization Setup (Phase 4).

All endpoints are Admin-only (enforced by @require_role(EmployeeRole.admin)).

Endpoints
---------
Departments
  GET    /api/org/departments
  POST   /api/org/departments
  GET    /api/org/departments/<id>
  PATCH  /api/org/departments/<id>
  DELETE /api/org/departments/<id>          (soft-deactivate)

Asset Categories
  GET    /api/org/categories
  POST   /api/org/categories
  GET    /api/org/categories/<id>
  PATCH  /api/org/categories/<id>
  DELETE /api/org/categories/<id>           (soft-deactivate)

Employee Directory
  GET    /api/org/employees                 ?search=&role=&status=&department_id=
  GET    /api/org/employees/<id>
  PATCH  /api/org/employees/<id>/role       (role promotion — Admin only)
  PATCH  /api/org/employees/<id>/status     (activate / deactivate — Admin only)
"""

from flask import Blueprint

from app.controllers import org_controller
from app.middleware.auth import require_role
from app.models.employee import EmployeeRole

org_bp = Blueprint("org", __name__)

_admin = EmployeeRole.admin

# ── Departments ────────────────────────────────────────────────────────────────


@org_bp.get("/departments")
@require_role(_admin)
def list_departments():
    return org_controller.list_departments()


@org_bp.post("/departments")
@require_role(_admin)
def create_department():
    return org_controller.create_department()


@org_bp.get("/departments/<int:dept_id>")
@require_role(_admin)
def get_department(dept_id: int):
    return org_controller.get_department(dept_id)


@org_bp.patch("/departments/<int:dept_id>")
@require_role(_admin)
def update_department(dept_id: int):
    return org_controller.update_department(dept_id)


@org_bp.delete("/departments/<int:dept_id>")
@require_role(_admin)
def delete_department(dept_id: int):
    return org_controller.delete_department(dept_id)


# ── Asset Categories ──────────────────────────────────────────────────────────


@org_bp.get("/categories")
@require_role(_admin)
def list_categories():
    return org_controller.list_categories()


@org_bp.post("/categories")
@require_role(_admin)
def create_category():
    return org_controller.create_category()


@org_bp.get("/categories/<int:cat_id>")
@require_role(_admin)
def get_category(cat_id: int):
    return org_controller.get_category(cat_id)


@org_bp.patch("/categories/<int:cat_id>")
@require_role(_admin)
def update_category(cat_id: int):
    return org_controller.update_category(cat_id)


@org_bp.delete("/categories/<int:cat_id>")
@require_role(_admin)
def delete_category(cat_id: int):
    return org_controller.delete_category(cat_id)


# ── Employee Directory ────────────────────────────────────────────────────────


@org_bp.get("/employees")
@require_role(_admin)
def list_employees():
    return org_controller.list_employees()


@org_bp.get("/employees/<int:emp_id>")
@require_role(_admin)
def get_employee(emp_id: int):
    return org_controller.get_employee(emp_id)


@org_bp.patch("/employees/<int:emp_id>/role")
@require_role(_admin)
def promote_employee(emp_id: int):
    return org_controller.promote_employee(emp_id)


@org_bp.patch("/employees/<int:emp_id>/status")
@require_role(_admin)
def set_employee_status(emp_id: int):
    return org_controller.set_employee_status(emp_id)
