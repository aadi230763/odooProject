from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.extensions import db


class ActivityLog(db.Model):
    """Append-only audit trail — no updated_at.

    The ``log_metadata`` Python attribute maps to the ``metadata`` DB column
    (name reserved by SQLAlchemy's DeclarativeBase).
    """

    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_activity_logs_actor"),
        nullable=True,  # nullable: system-generated actions have no actor
    )
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    log_metadata = db.Column("metadata", JSONB, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    actor = db.relationship("Employee", foreign_keys=[actor_id])

    def __repr__(self) -> str:
        return f"<ActivityLog action={self.action!r} entity={self.entity_type}/{self.entity_id}>"  # noqa: E501
