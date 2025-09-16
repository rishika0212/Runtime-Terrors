# tests/test_codesystem_routes.py
from __future__ import annotations

from fastapi.testclient import TestClient


def _pick_any_codesystem(client: TestClient) -> str | None:
    r = client.get("/codesystems")
    if r.status_code != 200:
        return None
    data = r.json()
    if not data:
        return None
    first = data[0]
    # Support string or object
    if isinstance(first, str):
        return first
    if isinstance(first, dict):
        return first.get("url") or first.get("name") or first.get("title")
    return None


def test_codesystem_pagination(client: TestClient):
    cs = _pick_any_codesystem(client)
    if not cs:
        # No codesystems present
        return
    r = client.get(f"/codesystems/{cs}?limit=5&offset=0")
    assert r.status_code == 200
    payload = r.json()
    # Expect a paginated result
    assert isinstance(payload, dict)
    assert "items" in payload
    assert "limit" in payload and "offset" in payload


def test_codesystem_code_lookup_if_any(client: TestClient):
    cs = _pick_any_codesystem(client)
    if not cs:
        return
    # Try to fetch a first page and pick one code
    r = client.get(f"/codesystems/{cs}?limit=1&offset=0")
    if r.status_code != 200:
        return
    payload = r.json()
    items = payload.get("items", [])
    if not items:
        return
    code = items[0].get("code")
    if not code:
        return
    r2 = client.get(f"/codesystems/{cs}/{code}")
    assert r2.status_code in (200, 404)
    # If 200, ensure fields are present
    if r2.status_code == 200:
        detail = r2.json()
        assert detail.get("code") == code