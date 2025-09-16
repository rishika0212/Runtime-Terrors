# api/semantic.py
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

import threading

try:
    import numpy as np
except Exception:  # numpy may be optional until semantic is used
    np = None  # type: ignore

# Defaults align with scripts/precompute_icd_embeddings.py
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EMBED_PATH = REPO_ROOT / "db" / "embeddings" / "icd_alias_embeddings.npz"
DEFAULT_MODEL_NAME = os.environ.get(
    "SEMANTIC_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
EMBED_PATH = Path(os.environ.get("SEMANTIC_EMBEDDINGS", str(DEFAULT_EMBED_PATH)))

# Prefer MMS display if a code exists in multiple CodeSystems
PREFERRED_MMS_URL = "https://id.who.int/icd/release/11/2024-01/mms"

_model = None
_codes: Optional[Sequence[str]] = None
_vectors: Optional["np.ndarray"] = None
_lock = threading.RLock()


def available() -> bool:
    """Return True if embeddings are present and numpy is importable."""
    if np is None:
        return False
    return EMBED_PATH.exists()


def _load_embeddings_if_needed() -> Tuple[Sequence[str], "np.ndarray"]:
    global _codes, _vectors
    if _codes is not None and _vectors is not None:
        return _codes, _vectors
    if np is None:
        raise RuntimeError("numpy not available. Install numpy to enable semantic search.")
    if not EMBED_PATH.exists():
        raise RuntimeError(f"Embeddings file not found at {EMBED_PATH}.")
    with _lock:
        if _codes is not None and _vectors is not None:
            return _codes, _vectors
        data = np.load(EMBED_PATH, allow_pickle=True)
        codes = list(data["codes"].astype(object))  # type: ignore
        vectors = data["vectors"].astype("float32")
        # L2-normalize for cosine via dot
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vectors = vectors / norms
        _codes, _vectors = codes, vectors
        return _codes, _vectors


def _load_model_if_needed():
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
        except Exception as e:
            raise RuntimeError("sentence-transformers not available. Install sentence-transformers to enable semantic search.") from e
        _model = SentenceTransformer(DEFAULT_MODEL_NAME)
        return _model


def _resolve_system_ids(conn, systems: Optional[Iterable[str]]) -> List[int]:
    if not systems:
        return []
    cur = conn.cursor()
    ids: List[int] = []
    seen: set[int] = set()
    for s in systems:
        cur.execute(
            "SELECT id FROM CodeSystem WHERE url=? OR name=? OR title=?",
            (s, s, s),
        )
        row = cur.fetchone()
        if row:
            i = int(row[0])
            if i not in seen:
                seen.add(i)
                ids.append(i)
    return ids


def _pick_best_concept_row(conn, code: str, allowed_cs_ids: Optional[Sequence[int]] = None) -> Optional[Tuple[str, str, str]]:
    """
    Returns (system_url, display, definition) for the code, preferring MMS if available.
    Optionally restrict to allowed CodeSystem IDs.
    """
    cur = conn.cursor()
    sql = (
        "SELECT cs.url, COALESCE(c.display,''), COALESCE(c.definition,'') "
        "FROM Concept c JOIN CodeSystem cs ON cs.id=c.codesystem_id WHERE c.code=?"
    )
    params: List[object] = [code]
    if allowed_cs_ids:
        placeholders = ",".join(["?"] * len(allowed_cs_ids))
        sql += f" AND c.codesystem_id IN ({placeholders})"
        params.extend(list(allowed_cs_ids))
    # Prefer MMS, then longer display as a weak proxy for informativeness
    sql += " ORDER BY (cs.url = ?) DESC, LENGTH(c.display) DESC LIMIT 1"
    params.append(PREFERRED_MMS_URL)
    cur.execute(sql, tuple(params))
    row = cur.fetchone()
    if not row:
        return None
    return str(row[0]), str(row[1]), str(row[2])


def semantic_search(
    conn,
    q: str,
    top_k: int = 25,
    systems: Optional[Iterable[str]] = None,
):
    """
    Returns a list of dicts compatible with SearchResult for the best matching codes.
    """
    if np is None:
        raise RuntimeError("numpy not available. Install numpy to enable semantic search.")
    codes, vectors = _load_embeddings_if_needed()
    model = _load_model_if_needed()

    # Encode query and normalize
    query_vec = model.encode([q], normalize_embeddings=True)
    if isinstance(query_vec, list):
        query_vec = np.array(query_vec, dtype=np.float32)
    qv = query_vec[0]
    # ensure unit
    norm = np.linalg.norm(qv)
    if norm == 0:
        return []
    qv = qv / norm

    # cosine similarity via dot product
    sims = vectors @ qv.astype("float32")
    # Top indices
    k = int(top_k)
    k = max(1, min(k, len(codes)))
    top_idx = np.argpartition(-sims, k - 1)[:k]
    # Sort by score desc
    top_idx = top_idx[np.argsort(-sims[top_idx])]

    allowed_ids = _resolve_system_ids(conn, systems)

    results = []
    for i in top_idx:
        code = str(codes[int(i)])
        meta = _pick_best_concept_row(conn, code, allowed_cs_ids=allowed_ids if allowed_ids else None)
        if not meta:
            # If concept not in DB (should not happen if step3 loaded), still return code with generic system
            system_url = PREFERRED_MMS_URL
            display = ""
            definition = ""
        else:
            system_url, display, definition = meta
        results.append(
            {
                "system": system_url,
                "code": code,
                "display": display,
                "definition": definition,
                "score": float(sims[int(i)]),
            }
        )
    return results