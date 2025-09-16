# tests/test_semantic_and_suggest.py
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def test_semantic_search_available(client: TestClient, has_embeddings: bool):
    if not has_embeddings:
        pytest.skip("Embeddings not present")
    r = client.get("/search/semantic", params={"q": "vata"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data


def test_suggest_from_text(client: TestClient, has_embeddings: bool):
    if not has_embeddings:
        pytest.skip("Embeddings not present")
    r = client.post("/suggest", json={"system": "NAMASTE-Ayurveda", "text": "vata dosha", "limit": 5})
    # Either 200 (available) or 503 if embeddings/model missing
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        data = r.json()
        assert "items" in data