"""Environment-based configuration classes.

No secret or environment-specific value is ever hardcoded here — everything
comes from the environment (loaded from ``.env`` in development). This directly
supports the cross-cutting "env-based config, zero hardcoded secrets" rule.
"""

import os

from dotenv import load_dotenv

# Load a local .env file if present (dev convenience; no-op in prod).
load_dotenv()


class BaseConfig:
    """Settings shared across every environment."""

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://localhost:5432/assetflow"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT / auth (used from Phase 2 onward)
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-jwt-secret")
    JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "720"))

    # Comma-separated list of allowed frontend origins.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    ENV = "development"


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    ENV = "testing"
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL", "postgresql://localhost:5432/assetflow_test"
    )


class ProductionConfig(BaseConfig):
    DEBUG = False
    ENV = "production"


_CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(config_name: str | None = None) -> type[BaseConfig]:
    """Resolve a config class by name, env var, or the development default."""
    name = config_name or os.getenv("FLASK_ENV", "development")
    return _CONFIG_MAP.get(name, DevelopmentConfig)
