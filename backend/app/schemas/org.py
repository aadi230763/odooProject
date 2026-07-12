"""Request-validation schemas for the Organization Setup module (Phase 4).

Covers:
  - Departments   (create / update / deactivate)
  - AssetCategory (create / update)
  - Employee      (list filters, role promotion, status toggle)
"""

from marshmallow import Schema, fields, validate


# ── Departments ───────────────────────────────────────────────────────────────


class DepartmentCreateSchema(Schema):
    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100),
        error_messages={"required": "Department name is required."},
    )
    head_employee_id = fields.Int(load_default=None, allow_none=True)
    parent_department_id = fields.Int(load_default=None, allow_none=True)


class DepartmentUpdateSchema(Schema):
    """All fields optional — PATCH semantics."""

    name = fields.Str(validate=validate.Length(min=2, max=100))
    head_employee_id = fields.Int(allow_none=True)
    parent_department_id = fields.Int(allow_none=True)
    status = fields.Str(validate=validate.OneOf(["active", "inactive"]))


# ── Asset Categories ──────────────────────────────────────────────────────────


class CategoryCreateSchema(Schema):
    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100),
        error_messages={"required": "Category name is required."},
    )
    # Free-form JSONB: {"warranty_months": 24, "requires_calibration": true}
    custom_fields = fields.Dict(keys=fields.Str(), load_default=None, allow_none=True)


class CategoryUpdateSchema(Schema):
    name = fields.Str(validate=validate.Length(min=2, max=100))
    custom_fields = fields.Dict(keys=fields.Str(), allow_none=True)
    status = fields.Str(validate=validate.OneOf(["active", "inactive"]))


# ── Employee Directory ────────────────────────────────────────────────────────


class EmployeeRolePromoteSchema(Schema):
    role = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["admin", "asset_manager", "department_head", "employee"],
            error=(
                "Role must be one of: admin, asset_manager,"
                " department_head, employee."
            ),
        ),
        error_messages={"required": "Role is required."},
    )


class EmployeeStatusSchema(Schema):
    status = fields.Str(
        required=True,
        validate=validate.OneOf(["active", "inactive"]),
        error_messages={"required": "Status is required."},
    )
