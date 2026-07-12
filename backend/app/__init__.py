"""Application factory for the AssetFlow backend.

Creates and configures the Flask app, initializes extensions, registers
blueprints, and wires up central error handling. Keeping this thin and
declarative is what lets every feature module plug into the same spine.
"""

from flask import Flask

from app.config import get_config
from app.extensions import bcrypt, cors, db, migrate


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
    _register_blueprints(app)

    return app


def _init_extensions(app: Flask) -> None:
    """Bind Flask extensions to the application instance."""
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})


def _register_blueprints(app: Flask) -> None:
    """Register all route blueprints. New modules are wired up here."""
    from app.routes.health import health_bp

    app.register_blueprint(health_bp, url_prefix="/api")
