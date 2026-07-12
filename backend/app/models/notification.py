from sqlalchemy.sql import func

from app.extensions import db


class Notification(db.Model):
    """Append-only feed — no updated_at."""

    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    recipient_id = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_notifications_recipient"),
        nullable=False,
    )
    type = db.Column(db.String(80), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    related_entity_type = db.Column(db.String(50), nullable=True)
    related_entity_id = db.Column(db.Integer, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    recipient = db.relationship("Employee", foreign_keys=[recipient_id])

    def __repr__(self) -> str:
        return f"<Notification type={self.type!r} read={self.is_read}>"
