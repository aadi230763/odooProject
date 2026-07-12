"""Application factory for the AssetFlow backend.

Creates and configures the Flask app, initialises extensions, registers
blueprints, wires up central error handling, and installs a lightweight
per-request logger.  Keeping this thin and declarative is what lets every
feature module plug into the same spine.
"""

from __future__ import annotations

import logging
import time

from flask import Flask, g, request

from app.config import get_config
from app.extensions import bcrypt, cors, db, migrate

logger = logging.getLogger("assetflow.requests")


def create_app(config_name: str | None = None) -> Flask:
    """Build a configured Flask application instance.

    Args:
        config_name: One of ``development``, ``testing``, ``production``.
            Falls back to the ``FLASK_ENV`` environment variable, then to
            ``development``.
    """
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    _init_extensions(app)
    _register_error_handlers(app)
    _register_request_logging(app)
    _register_blueprints(app)

    return app


def _init_extensions(app: Flask) -> None:
    """Bind Flask extensions to the application instance."""
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})


def _register_error_handlers(app: Flask) -> None:
    """Wire up central JSON error handling (no stack traces to clients)."""
    from app.middleware.error_handler import register_error_handlers

    register_error_handlers(app)


def _register_request_logging(app: Flask) -> None:
    """Log every request: method, path, status code, and latency in ms."""

    @app.before_request
    def _start_timer() -> None:
        g._request_start = time.monotonic()

    @app.after_request
    def _log_request(response):
        elapsed_ms = int((time.monotonic() - g._request_start) * 1000)
        logger.info(
            "%s %s → %d (%d ms)",
            request.method,
            request.path,
            response.status_code,
            elapsed_ms,
        )
        return response


def _register_blueprints(flask_app: Flask) -> None:
    """Register all route blueprints. New modules are wired up here."""
    from app import models  # noqa: F401 — populate db.metadata for Flask-Migrate
    from app.routes.auth import auth_bp
    from app.routes.health import health_bp
    from app.routes.org import org_bp
    from app.routes.asset import asset_bp
    from app.routes.allocation import allocation_bp
    from app.routes.booking import booking_bp
    from app.routes.maintenance import maintenance_bp
    from app.routes.audit import audit_bp
    from app.routes.dashboard import dashboard_bp, notifications_bp, logs_bp

    flask_app.register_blueprint(health_bp, url_prefix="/api")
    flask_app.register_blueprint(auth_bp, url_prefix="/api/auth")
    flask_app.register_blueprint(org_bp, url_prefix="/api/org")
    flask_app.register_blueprint(asset_bp, url_prefix="/api/assets")
    flask_app.register_blueprint(allocation_bp, url_prefix="/api")
    flask_app.register_blueprint(booking_bp, url_prefix="/api/bookings")
    flask_app.register_blueprint(maintenance_bp, url_prefix="/api/maintenance")
    flask_app.register_blueprint(audit_bp, url_prefix="/api/audits")
    flask_app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    flask_app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    flask_app.register_blueprint(logs_bp, url_prefix="/api/logs")
