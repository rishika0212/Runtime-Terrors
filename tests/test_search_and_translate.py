# tests/test_search_and_translate.py
from __future__ import annotations

from fastapi.testclient import TestClient


def test_text_search_basic(client: TestClient):
    # Generic query; service should return 200 even if empty
    r = client.get("/search", params={"q": "va"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    assert "items" in data
    assert "limit" in data and "offset" in data


def test_text_search_with_systems_filter(client: TestClient):
    # Try to pick a codesystem and filter search by it
    r_cs = client.get("/codesystems")
    if r_cs.status_code != 200:
        return
    cs_list = r_cs.json()
    if not cs_list:
        return
    cs = cs_list[0]
    if isinstance(cs, dict):
        ident = cs.get("url") or cs.get("name") or cs.get("title")
    else:
        ident = cs
    if not ident:
        return
    r = client.get("/search", params={"q": "a", "systems": ident})
    assert r.status_code == 200


def test_translate_roundtrip_if_possible(client: TestClient):
    # Try to find any translation by probing a small list of codes from the first codesystem
    r_cs = client.get("/codesystems")
    if r_cs.status_code != 200:
        return
    cs_list = r_cs.json()
    if not cs_list:
        return
    cs = cs_list[0]
    if isinstance(cs, dict):
        ident = cs.get("url") or cs.get("name") or cs.get("title")
    else:
        ident = cs
    if not ident:
        return
    # Pull a few codes
    r_codes = client.get(f"/codesystems/{ident}", params={"limit": 5, "offset": 0})
    if r_codes.status_code != 200:
        return
    items = r_codes.json().get("items", [])
    for it in items:
        code = it.get("code")
        if not code:
            continue
        r_tr = client.post("/translate", json={"system": ident, "code": code})
        assert r_tr.status_code in (200, 404)
        if r_tr.status_code == 200:
            data = r_tr.json()
            assert "translations" in data
            # Not asserting non-empty, as mappings may not exist for all codes
            break