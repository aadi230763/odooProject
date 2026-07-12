import enum

from app.extensions import db
from app.models.base import TimestampMixin


class DocumentType(enum.Enum):
    photo = "photo"
    document = "document"


class AssetDocument(db.Model, TimestampMixin):
    __tablename__ = "asset_documents"

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(
        db.Integer,
        db.ForeignKey("assets.id", name="fk_asset_documents_asset"),
        nullable=False,
    )
    file_path = db.Column(db.String(500), nullable=False)
    doc_type = db.Column(
        db.Enum(DocumentType, name="document_type"),
        nullable=False,
        default=DocumentType.photo,
    )

    asset = db.relationship("Asset", back_populates="documents")

    def __repr__(self) -> str:
        return f"<AssetDocument asset_id={self.asset_id} type={self.doc_type.value!r}>"
