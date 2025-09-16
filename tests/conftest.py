# tests/conftest.py
from __future__ import annotations

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Import the FastAPI app
from api.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def db_path() -> Path:
    # Align with api.db default
    repo_root = Path(__file__).resolve().parents[1]
    return Path(os.environ.get("TERMINOLOGY_DB", str(repo_root / "db" / "terminology.db")))


@pytest.fixture(scope="session")
def embeddings_path() -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    default = repo_root / "db" / "embeddings" / "icd_alias_embeddings.npz"
    return Path(os.environ.get("SEMANTIC_EMBEDDINGS", str(default)))


@pytest.fixture(scope="session")
def has_embeddings(embeddings_path: Path) -> bool:
    return embeddings_path.exists()