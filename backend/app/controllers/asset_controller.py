"""Asset controller — HTTP layer mapping routes to service calls."""

from __future__ import annotations

from flask import g, request
from marshmallow import ValidationError

from app.services import asset_service
from app.utils.responses import error_response, success_response


def _flatten(messages: dict) -> dict[str, str]:
    return {
        field: (errs[0] if isinstance(errs, list) else str(errs))
        for field, errs in messages.items()
    }


def _handle_errors(exc: ValueError):
    msg = str(exc)
    if msg == "NOT_FOUND":
        return error_response("NOT_FOUND", "Asset not found.", status=404)
    if msg == "NOT_FOUND_CATEGORY":
        return error_response(
            "NOT_FOUND_CATEGORY", "The specified category does not exist.", status=422
        )
    if msg.startswith("INVALID_TRANSITION"):
        return error_response("INVALID_TRANSITION", msg, status=409)
    if msg == "INVALID_DOCUMENT_TYPE":
        return error_response(
            "INVALID_DOCUMENT_TYPE", "Must be 'photo' or 'document'.", status=400
        )
    if msg.startswith("UPLOAD_FAILED"):
        return error_response("UPLOAD_FAILED", msg, status=400)

    return error_response("BAD_REQUEST", msg, status=400)


def list_assets():
    search = request.args.get("search", "").strip() or None
    cat_id_raw = request.args.get("category_id")
    category_id = int(cat_id_raw) if cat_id_raw and cat_id_raw.isdigit() else None
    status = request.args.get("status") or None
    location = request.args.get("location") or None

    assets = asset_service.list_assets(
        search=search, category_id=category_id, status=status, location=location
    )
    return success_response(
        data={"assets": [asset_service.asset_dict(a) for a in assets]}
    )


def get_asset(asset_id: int):
    try:
        asset = asset_service.get_asset(asset_id)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(data={"asset": asset_service.asset_dict(asset)})


def get_asset_by_tag(asset_tag: str):
    try:
        asset = asset_service.get_asset_by_tag(asset_tag)
    except ValueError as exc:
        return _handle_errors(exc)
    return success_response(data={"asset": asset_service.asset_dict(asset)})


def create_asset():
    data = request.get_json(silent=True) or {}
    try:
        asset = asset_service.create_asset(data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)

    return success_response(
        data={"asset": asset_service.asset_dict(asset)},
        message="Asset registered successfully.",
        status=201,
    )


def update_asset(asset_id: int):
    data = request.get_json(silent=True) or {}
    try:
        asset = asset_service.update_asset(asset_id, data, actor_id=g.current_user.id)
    except ValidationError as exc:
        return error_response(
            "VALIDATION_ERROR",
            "Please correct the errors below.",
            fields=_flatten(exc.messages),
            status=400,
        )
    except ValueError as exc:
        return _handle_errors(exc)

    return success_response(
        data={"asset": asset_service.asset_dict(asset)},
        message="Asset updated.",
    )


def upload_document(asset_id: int):
    if "file" not in request.files:
        return error_response("MISSING_FILE", "No file part in request.", status=400)
    file = request.files["file"]
    if file.filename == "":
        return error_response("MISSING_FILE", "No selected file.", status=400)

    doc_type = request.form.get("doc_type", "photo")
    try:
        doc = asset_service.upload_asset_document(
            asset_id, file, doc_type, actor_id=g.current_user.id
        )
    except ValueError as exc:
        return _handle_errors(exc)

    return success_response(
        data={"document": asset_service.document_dict(doc)},
        message="Document uploaded successfully.",
        status=201,
    )


def get_documents(asset_id: int):
    try:
        docs = asset_service.get_asset_documents(asset_id)
    except ValueError as exc:
        return _handle_errors(exc)

    return success_response(
        data={"documents": [asset_service.document_dict(d) for d in docs]}
    )
