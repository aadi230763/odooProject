"""Request-validation schemas for the Maintenance module (Phase 8)."""

from marshmallow import Schema, fields, validate


class MaintenanceRaiseSchema(Schema):
    """Schema for raising a new maintenance request."""

    asset_id = fields.Int(
        required=True,
        error_messages={"required": "Asset is required."},
    )
    description = fields.Str(
        required=True,
        validate=validate.Length(min=10, max=2000),
        error_messages={
            "required": "Description is required.",
            "validator_failed": "Description must be at least 10 characters.",
        },
    )
    priority = fields.Str(
        load_default="medium",
        validate=validate.OneOf(
            ["low", "medium", "high", "critical"],
            error="Priority must be one of: low, medium, high, critical.",
        ),
    )


class MaintenanceApproveSchema(Schema):
    """Schema for approving a maintenance request (Asset Manager only)."""

    notes = fields.Str(load_default=None, allow_none=True)


class MaintenanceRejectSchema(Schema):
    """Schema for rejecting a maintenance request (Asset Manager only)."""

    notes = fields.Str(load_default=None, allow_none=True)


class MaintenanceAssignTechnicianSchema(Schema):
    """Schema for assigning a technician."""

    technician_id = fields.Int(
        required=True,
        error_messages={"required": "Technician ID is required."},
    )


class MaintenanceResolveSchema(Schema):
    """Schema for resolving a maintenance request."""

    notes = fields.Str(load_default=None, allow_none=True)
