# tests/test_health_and_codesystems.py
from __future__ import annotations

from fastapi.testclient import TestClient


def test_healthz(client: TestClient):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_get_codesystems_list(client: TestClient):
    resp = client.get("/codesystems")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # Each item should have at least url/name/title keys or be a simple string depending on implementation
    if data:
        item = data[0]
        # Support both object or string representations
        assert isinstance(item, (dict, str))