"""Shared mixin that adds created_at / updated_at to every model."""

from sqlalchemy.sql import func

from app.extensions import db


class TimestampMixin:
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
