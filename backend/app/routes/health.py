"""Health-check blueprint.

The minimal "hello world" API that proves the backend boots and serves the
standard response envelope. Later phases add real feature blueprints alongside
this one.
"""

from flask import Blueprint

from app.utils.responses import success_response

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    """Liveness probe. Returns 200 with the standard envelope."""
    return success_response(
        data={"status": "ok", "service": "assetflow-backend"},
        message="AssetFlow backend is running.",
    )
