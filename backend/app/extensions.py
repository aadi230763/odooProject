"""Flask extension singletons.

Instantiated here (unbound) so they can be imported anywhere without creating
a circular dependency on the app factory. They are bound to the app inside
``create_app`` via ``init_app``.
"""

from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
bcrypt = Bcrypt()
cors = CORS()
