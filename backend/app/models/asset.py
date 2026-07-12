import enum

from sqlalchemy import event, text

from app.extensions import db
from app.models.base import TimestampMixin


class AssetCondition(enum.Enum):
    new = "new"
    good = "good"
    fair = "fair"
    poor = "poor"


class AssetStatus(enum.Enum):
    available = "available"
    allocated = "allocated"
    reserved = "reserved"
    under_maintenance = "under_maintenance"
    lost = "lost"
    retired = "retired"
    disposed = "disposed"


# Valid state transitions for the lifecycle state machine (Phase 5).
VALID_TRANSITIONS: dict[AssetStatus, set[AssetStatus]] = {
    AssetStatus.available: {
        AssetStatus.allocated,
        AssetStatus.reserved,
        AssetStatus.under_maintenance,
        AssetStatus.retired,
    },
    AssetStatus.allocated: {
        AssetStatus.available,
        AssetStatus.under_maintenance,
        AssetStatus.lost,
    },
    AssetStatus.reserved: {
        AssetStatus.available,
        AssetStatus.allocated,
    },
    AssetStatus.under_maintenance: {
        AssetStatus.available,
        AssetStatus.retired,
        AssetStatus.disposed,
    },
    AssetStatus.lost: {
        AssetStatus.available,
        AssetStatus.disposed,
    },
    AssetStatus.retired: {
        AssetStatus.disposed,
    },
    AssetStatus.disposed: set(),
}


class Asset(db.Model, TimestampMixin):
    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    # asset_tag is auto-generated from asset_tag_seq via a before_insert event.
    asset_tag = db.Column(db.String(20), nullable=False, unique=True)
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("asset_categories.id", name="fk_assets_category"),
        nullable=False,
    )
    serial_number = db.Column(db.String(100), nullable=True)
    acquisition_date = db.Column(db.Date, nullable=True)
    # Stored for ranking/reporting only — never linked to financial logic.
    acquisition_cost = db.Column(db.Numeric(12, 2), nullable=True)
    condition = db.Column(
        db.Enum(AssetCondition, name="asset_condition"),
        nullable=False,
        default=AssetCondition.good,
    )
    location = db.Column(db.String(200), nullable=True)
    is_bookable = db.Column(db.Boolean, nullable=False, default=False)
    qr_code_path = db.Column(db.String(500), nullable=True)
    status = db.Column(
        db.Enum(AssetStatus, name="asset_status"),
        nullable=False,
        default=AssetStatus.available,
    )

    category = db.relationship("AssetCategory", back_populates="assets")
    documents = db.relationship(
        "AssetDocument", back_populates="asset", cascade="all, delete-orphan"
    )
    allocations = db.relationship("Allocation", back_populates="asset")
    transfer_requests = db.relationship("TransferRequest", back_populates="asset")
    bookings = db.relationship("Booking", back_populates="resource_asset")
    maintenance_requests = db.relationship("MaintenanceRequest", back_populates="asset")
    audit_items = db.relationship("AuditItem", back_populates="asset")

    def __repr__(self) -> str:
        return f"<Asset {self.asset_tag!r} {self.name!r}>"


@event.listens_for(Asset, "before_insert")
def _generate_asset_tag(mapper, connection, target):  # type: ignore[no-untyped-def]
    """Pull the next value from asset_tag_seq to build AF-0001 style tags."""
    if not target.asset_tag:
        result = connection.execute(
            text("SELECT 'AF-' || LPAD(nextval('asset_tag_seq')::text, 4, '0')")
        )
        target.asset_tag = result.scalar()
