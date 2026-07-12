"""Service layer package.

Import service modules here so controllers can use the pattern::

    from app import services
    services.auth_service.signup(data)
"""

from app.services import auth_service  # noqa: F401
