"""Request-validation schemas for the auth module.

Schemas are used in the service layer via ``schema.load(data)``, which raises
``marshmallow.ValidationError`` on bad input. The controller layer catches
that exception and converts it to the standard error envelope.
"""

from marshmallow import Schema, ValidationError, fields, validate, validates


class SignupSchema(Schema):
    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=150),
        error_messages={"required": "Name is required."},
    )
    email = fields.Email(
        required=True,
        error_messages={
            "required": "Email is required.",
            "validator_failed": "Enter a valid email address.",
        },
    )
    password = fields.Str(
        required=True,
        load_only=True,
        error_messages={"required": "Password is required."},
    )
    department_id = fields.Int(load_default=None, allow_none=True)

    @validates("password")
    def validate_password(self, value: str) -> None:
        if len(value) < 8:
            raise ValidationError("Password must be at least 8 characters.")


class LoginSchema(Schema):
    email = fields.Email(
        required=True,
        error_messages={"required": "Email is required."},
    )
    password = fields.Str(
        required=True,
        load_only=True,
        error_messages={"required": "Password is required."},
    )


class ForgotPasswordSchema(Schema):
    email = fields.Email(
        required=True,
        error_messages={"required": "Email is required."},
    )
