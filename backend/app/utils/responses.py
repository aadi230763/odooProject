"""Standard API response envelope helpers.

Every endpoint in AssetFlow returns one of these two shapes so the frontend
can rely on a single, consistent contract:

    success: { "success": true,  "data": {...}, "message": "..." }
    error:   { "success": false, "error": { "code": "...", "fields": {...} } }
"""

from typing import Any

from flask import jsonify
from flask.wrappers import Response


def success_response(
    data: Any = None, message: str = "", status: int = 200
) -> tuple[Response, int]:
    """Build a standard success envelope."""
    return jsonify({"success": True, "data": data, "message": message}), status


def error_response(
    code: str,
    message: str = "",
    fields: dict[str, str] | None = None,
    status: int = 400,
) -> tuple[Response, int]:
    """Build a standard error envelope."""
    error: dict[str, Any] = {"code": code}
    if message:
        error["message"] = message
    if fields:
        error["fields"] = fields
    return jsonify({"success": False, "error": error}), status
