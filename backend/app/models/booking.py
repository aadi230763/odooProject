import enum

from sqlalchemy import CheckConstraint

from app.extensions import db
from app.models.base import TimestampMixin


class BookingStatus(enum.Enum):
    upcoming = "upcoming"
    ongoing = "ongoing"
    completed = "completed"
    cancelled = "cancelled"


class Booking(db.Model, TimestampMixin):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="chk_bookings_end_after_start"),
        # DB-level overlap guard is the EXCLUDE constraint added in the migration:
        # ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
        #   EXCLUDE USING gist (
        #     resource_asset_id WITH =,
        #     tstzrange(start_time, end_time) WITH &&
        #   ) WHERE (status::text <> 'cancelled');
    )

    id = db.Column(db.Integer, primary_key=True)
    resource_asset_id = db.Column(
        db.Integer,
        db.ForeignKey("assets.id", name="fk_bookings_resource_asset"),
        nullable=False,
    )
    booked_by = db.Column(
        db.Integer,
        db.ForeignKey("employees.id", name="fk_bookings_booked_by"),
        nullable=False,
    )
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    status = db.Column(
        db.Enum(BookingStatus, name="booking_status"),
        nullable=False,
        default=BookingStatus.upcoming,
    )

    resource_asset = db.relationship("Asset", back_populates="bookings")
    employee = db.relationship("Employee", foreign_keys=[booked_by])

    def __repr__(self) -> str:
        return (
            f"<Booking resource={self.resource_asset_id} status={self.status.value!r}>"
        )
