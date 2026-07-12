"""Request-validation schemas for the Asset Registration module (Phase 5)."""

from marshmallow import Schema, fields, validate


class AssetCreateSchema(Schema):
    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=200),
        error_messages={"required": "Asset name is required."},
    )
    category_id = fields.Int(
        required=True,
        error_messages={"required": "Category is required."},
    )
    serial_number = fields.Str(load_default=None, allow_none=True)
    acquisition_date = fields.Date(load_default=None, allow_none=True)
    acquisition_cost = fields.Decimal(
        places=2, load_default=None, allow_none=True, as_string=True
    )
    condition = fields.Str(
        load_default="good",
        validate=validate.OneOf(["new", "good", "fair", "poor"]),
    )
    location = fields.Str(load_default=None, allow_none=True)
    is_bookable = fields.Bool(load_default=False)
    # Note: Status defaults to 'available' on creation


class AssetUpdateSchema(Schema):
    """All fields optional — PATCH semantics."""

    name = fields.Str(validate=validate.Length(min=2, max=200))
    category_id = fields.Int()
    serial_number = fields.Str(allow_none=True)
    acquisition_date = fields.Date(allow_none=True)
    acquisition_cost = fields.Decimal(places=2, allow_none=True, as_string=True)
    condition = fields.Str(validate=validate.OneOf(["new", "good", "fair", "poor"]))
    location = fields.Str(allow_none=True)
    is_bookable = fields.Bool()
    status = fields.Str(
        validate=validate.OneOf(
            [
                "available",
                "allocated",
                "reserved",
                "under_maintenance",
                "lost",
                "retired",
                "disposed",
            ]
        )
    )
