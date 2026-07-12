"""Smoke test: the app boots and the health endpoint returns the envelope."""

from app import create_app


def test_health_endpoint_returns_ok_envelope():
    app = create_app("testing")
    client = app.test_client()

    resp = client.get("/api/health")
    body = resp.get_json()

    assert resp.status_code == 200
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
