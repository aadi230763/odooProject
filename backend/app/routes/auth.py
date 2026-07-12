"""Auth blueprint — thin HTTP layer.

Routes map HTTP verbs + paths to controller functions.  No business logic
lives here; no DB access happens here.

Endpoints
---------
POST   /api/auth/signup          Create an Employee account (role = employee)
POST   /api/auth/login           Authenticate and receive a JWT
POST   /api/auth/logout          Record logout (client discards token)
GET    /api/auth/me              Return current employee profile [protected]
POST   /api/auth/forgot-password Email reset stub [no-op in this phase]
"""

from flask import Blueprint

from app.controllers import auth_controller
from app.middleware.auth import require_role

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/signup")
def signup():
    return auth_controller.signup()


@auth_bp.post("/login")
def login():
    return auth_controller.login()


@auth_bp.post("/logout")
@require_role()          # any authenticated active employee
def logout():
    return auth_controller.logout()


@auth_bp.get("/me")
@require_role()          # proves RBAC works; used as the "protected sample endpoint"
def me():
    return auth_controller.me()


@auth_bp.post("/forgot-password")
def forgot_password():
    return auth_controller.forgot_password()
