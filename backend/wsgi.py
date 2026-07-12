"""WSGI entrypoint.

Run locally with:

    flask --app wsgi run --debug

or via a WSGI server (gunicorn) in production:

    gunicorn wsgi:app
"""

from app import create_app

app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
