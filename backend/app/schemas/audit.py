"""Request-validation schemas for the Audit Cycles module (Phase 9)."""

from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class AuditCycleCreateSchema(Schema):
    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=200),
        error_messages={"required": "Audit cycle name is required."},
    )
    start_date = fields.Date(
        required=True,
        error_messages={"required": "Start date is required."},
    )
    end_date = fields.Date(
        required=True,
        error_messages={"required": "End date is required."},
    )
    scope_department_id = fields.Int(load_default=None, allow_none=True)
    scope_location = fields.Str(
        load_default=None,
        allow_none=True,
        validate=validate.Length(max=200),
    )

    @validates_schema
    def validate_dates(self, data, **kwargs):
        start = data.get("start_date")
        end = data.get("end_date")
        if start and end and end < start:
            raise ValidationError(
                "End date must be on or after start date.", field_name="end_date"
            )


class AuditAssignAuditorsSchema(Schema):
    auditor_ids = fields.List(
        fields.Int(),
        required=True,
        validate=validate.Length(min=1),
        error_messages={"required": "At least one auditor ID is required."},
    )


class AuditItemMarkSchema(Schema):
    result = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["verified", "missing", "damaged"],
            error="Result must be one of: verified, missing, damaged.",
        ),
        error_messages={"required": "Result is required."},
    )
    notes = fields.Str(
        load_default=None, allow_none=True, validate=validate.Length(max=2000)
    )
