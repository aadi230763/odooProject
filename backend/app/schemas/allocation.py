"""Request-validation schemas for the Allocation module (Phase 6)."""

from marshmallow import Schema, fields, validate


class AllocationCreateSchema(Schema):
    asset_id = fields.Int(
        required=True,
        error_messages={"required": "Asset ID is required."},
    )
    holder_employee_id = fields.Int(load_default=None, allow_none=True)
    holder_department_id = fields.Int(load_default=None, allow_none=True)
    expected_return_date = fields.Date(load_default=None, allow_none=True)


class AllocationReturnSchema(Schema):
    checkin_condition_notes = fields.Str(
        load_default=None,
        allow_none=True,
        validate=validate.Length(max=2000),
    )


class TransferRequestCreateSchema(Schema):
    asset_id = fields.Int(
        required=True,
        error_messages={"required": "Asset ID is required."},
    )
    to_employee_id = fields.Int(
        required=True,
        error_messages={"required": "Target employee is required."},
    )


class TransferActionSchema(Schema):
    action = fields.Str(
        required=True,
        validate=validate.OneOf(["approve", "reject"]),
        error_messages={"required": "Action is required."},
    )
