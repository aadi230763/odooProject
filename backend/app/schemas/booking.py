"""Request-validation schemas for the Resource Booking module (Phase 7)."""

from marshmallow import Schema, fields, validates_schema, ValidationError


class BookingCreateSchema(Schema):
    resource_asset_id = fields.Int(
        required=True,
        error_messages={"required": "Resource asset is required."},
    )
    start_time = fields.DateTime(
        required=True,
        error_messages={"required": "Start time is required."},
    )
    end_time = fields.DateTime(
        required=True,
        error_messages={"required": "End time is required."},
    )

    @validates_schema
    def validate_time_range(self, data, **kwargs):
        start = data.get("start_time")
        end = data.get("end_time")
        if start and end and end <= start:
            raise ValidationError(
                "End time must be after start time.",
                field_name="end_time",
            )


class BookingCancelSchema(Schema):
    """Empty body is fine — action is implicit from the endpoint."""

    pass


class BookingRescheduleSchema(Schema):
    start_time = fields.DateTime(
        required=True,
        error_messages={"required": "New start time is required."},
    )
    end_time = fields.DateTime(
        required=True,
        error_messages={"required": "New end time is required."},
    )

    @validates_schema
    def validate_time_range(self, data, **kwargs):
        start = data.get("start_time")
        end = data.get("end_time")
        if start and end and end <= start:
            raise ValidationError(
                "End time must be after start time.",
                field_name="end_time",
            )
