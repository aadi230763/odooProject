"""Business logic for Asset Registration, Lifecycle, and Directory (Phase 5)."""

from __future__ import annotations

import os
import uuid
from typing import Any

import qrcode
from flask import current_app
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.asset import Asset, AssetCondition, AssetStatus, VALID_TRANSITIONS
from app.models.asset_category import AssetCategory
from app.models.asset_document import AssetDocument, DocumentType
from app.schemas.asset import AssetCreateSchema, AssetUpdateSchema
from app.utils.activity_logger import log_activity
from app.utils.file_upload import save_upload


def _generate_qr_code(asset_tag: str) -> str:
    """Generates a QR code image for the given asset tag and returns its path."""
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    qr_dir = os.path.join(upload_folder, "qrcodes")
    os.makedirs(qr_dir, exist_ok=True)

    filename = f"{asset_tag}_{uuid.uuid4().hex[:8]}.png"
    filepath = os.path.join(qr_dir, filename)

    # Encode just the tag for now (or a URL if needed later)
    img = qrcode.make(asset_tag)
    img.save(filepath)

    return f"uploads/qrcodes/{filename}"


def list_assets(
    search: str | None = None,
    category_id: int | None = None,
    status: str | None = None,
    location: str | None = None,
) -> list[Asset]:
    q = Asset.query

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            db.or_(
                Asset.name.ilike(pattern),
                Asset.asset_tag.ilike(pattern),
                Asset.serial_number.ilike(pattern),
            )
        )

    if category_id:
        q = q.filter(Asset.category_id == category_id)

    if status:
        try:
            q = q.filter(Asset.status == AssetStatus(status))
        except ValueError:
            pass

    if location:
        q = q.filter(Asset.location.ilike(f"%{location}%"))

    return q.order_by(Asset.created_at.desc()).all()


def get_asset(asset_id: int) -> Asset:
    asset = db.session.get(Asset, asset_id)
    if not asset:
        raise ValueError("NOT_FOUND")
    return asset


def get_asset_by_tag(asset_tag: str) -> Asset:
    asset = Asset.query.filter_by(asset_tag=asset_tag).first()
    if not asset:
        raise ValueError("NOT_FOUND")
    return asset


def create_asset(data: dict, actor_id: int) -> Asset:
    validated = AssetCreateSchema().load(data)

    cat_id = validated["category_id"]
    if not db.session.get(AssetCategory, cat_id):
        raise ValueError("NOT_FOUND_CATEGORY")

    asset = Asset(
        name=validated["name"].strip(),
        category_id=cat_id,
        serial_number=validated.get("serial_number"),
        acquisition_date=validated.get("acquisition_date"),
        acquisition_cost=validated.get("acquisition_cost"),
        condition=AssetCondition(validated["condition"]),
        location=validated.get("location"),
        is_bookable=validated["is_bookable"],
        status=AssetStatus.available,
    )

    db.session.add(asset)
    db.session.flush()  # to get the ID and auto-generated asset_tag

    asset.qr_code_path = _generate_qr_code(asset.asset_tag)

    log_activity(
        actor_id=actor_id,
        action="asset_registered",
        entity_type="asset",
        entity_id=asset.id,
        metadata={"asset_tag": asset.asset_tag, "name": asset.name},
    )
    db.session.commit()
    return asset


def update_asset(asset_id: int, data: dict, actor_id: int) -> Asset:
    asset = get_asset(asset_id)
    validated = AssetUpdateSchema().load(data)

    # State Machine Validation
    if "status" in validated:
        new_status = AssetStatus(validated["status"])
        if new_status != asset.status:
            allowed_next = VALID_TRANSITIONS.get(asset.status, set())
            if new_status not in allowed_next:
                raise ValueError(
                    f"INVALID_TRANSITION: Cannot transition from "
                    f"{asset.status.value} to {new_status.value}."
                )
            asset.status = new_status

    if "category_id" in validated:
        cat_id = validated["category_id"]
        if not db.session.get(AssetCategory, cat_id):
            raise ValueError("NOT_FOUND_CATEGORY")
        asset.category_id = cat_id

    if "name" in validated:
        asset.name = validated["name"].strip()
    if "serial_number" in validated:
        asset.serial_number = validated["serial_number"]
    if "acquisition_date" in validated:
        asset.acquisition_date = validated["acquisition_date"]
    if "acquisition_cost" in validated:
        asset.acquisition_cost = validated["acquisition_cost"]
    if "condition" in validated:
        asset.condition = AssetCondition(validated["condition"])
    if "location" in validated:
        asset.location = validated["location"]
    if "is_bookable" in validated:
        asset.is_bookable = validated["is_bookable"]

    log_activity(
        actor_id=actor_id,
        action="asset_updated",
        entity_type="asset",
        entity_id=asset.id,
        metadata={"changes": validated},
    )
    db.session.commit()
    return asset


def upload_asset_document(
    asset_id: int, file: FileStorage, doc_type: str, actor_id: int
) -> AssetDocument:
    asset = get_asset(asset_id)

    try:
        dt = DocumentType(doc_type)
    except ValueError:
        raise ValueError("INVALID_DOCUMENT_TYPE")

    try:
        file_path = save_upload(file, subfolder="assets")
    except ValueError as e:
        raise ValueError(f"UPLOAD_FAILED: {str(e)}")

    doc = AssetDocument(
        asset_id=asset.id,
        file_path=file_path,
        doc_type=dt,
    )
    db.session.add(doc)

    log_activity(
        actor_id=actor_id,
        action="asset_document_uploaded",
        entity_type="asset",
        entity_id=asset.id,
        metadata={"doc_type": dt.value, "file_path": file_path},
    )
    db.session.commit()
    return doc


def get_asset_documents(asset_id: int) -> list[AssetDocument]:
    asset = get_asset(asset_id)
    return asset.documents


# ── Serialisation helpers ───────────────────────────────────────────────────────


def asset_dict(a: Asset) -> dict[str, Any]:
    return {
        "id": a.id,
        "asset_tag": a.asset_tag,
        "name": a.name,
        "category_id": a.category_id,
        "category_name": a.category.name if a.category else None,
        "serial_number": a.serial_number,
        "acquisition_date": (
            a.acquisition_date.isoformat() if a.acquisition_date else None
        ),
        "acquisition_cost": float(a.acquisition_cost) if a.acquisition_cost else None,
        "condition": a.condition.value,
        "location": a.location,
        "is_bookable": a.is_bookable,
        "qr_code_path": a.qr_code_path,
        "status": a.status.value,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


def document_dict(d: AssetDocument) -> dict[str, Any]:
    return {
        "id": d.id,
        "asset_id": d.asset_id,
        "file_path": d.file_path,
        "doc_type": d.doc_type.value,
        "created_at": d.created_at.isoformat(),
    }
