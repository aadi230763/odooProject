import enum

from sqlalchemy.dialects.postgresql import JSONB

from app.extensions import db
from app.models.base import TimestampMixin


class CategoryStatus(enum.Enum):
    active = "active"
    inactive = "inactive"


class AssetCategory(db.Model, TimestampMixin):
    __tablename__ = "asset_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    # Stores category-specific field definitions, e.g. {"warranty_months": 24}.
    custom_fields = db.Column(JSONB, nullable=True)
    status = db.Column(
        db.Enum(CategoryStatus, name="category_status"),
        nullable=False,
        default=CategoryStatus.active,
    )

    assets = db.relationship("Asset", back_populates="category")

    def __repr__(self) -> str:
        return f"<AssetCategory {self.name!r}>"
