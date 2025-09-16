# api/routes/suggest.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException

from ..db import get_conn
from ..models import SuggestRequest, SuggestResponse, SuggestItem
from ..cache import cache
from .. import semantic

router = APIRouter(prefix="/suggest", tags=["Suggest"])


@router.post(
    "",
    response_model=SuggestResponse,
    summary="Suggest semantic mappings (ICD-11 candidates)",
    description=(
        "Given a source code (or free text), returns top ICD-11 candidate codes ranked by semantic similarity. "
        "If a source code is provided, its display/definition text from the DB is used as the query."
    ),
)
def suggest(req: SuggestRequest):
    if not semantic.available():
        raise HTTPException(status_code=503, detail="Semantic search not available. Generate embeddings first.")

    query_text: Optional[str] = req.text
    source_system = req.system
    source_code = req.code

    cache_key = ("suggest", source_system, source_code, query_text, tuple(sorted(req.target_systems)) if req.target_systems else None, req.limit)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        # If code provided and no explicit text, pull display/definition as the query
        if source_code and not query_text:
            cur = conn.cursor()
            cur.execute("SELECT id FROM CodeSystem WHERE url=? OR name=? OR title=?", (source_system, source_system, source_system))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Source CodeSystem not found")
            cs_id = int(row[0])
            cur.execute(
                "SELECT COALESCE(display,''), COALESCE(definition,'') FROM Concept WHERE codesystem_id=? AND code=?",
                (cs_id, source_code),
            )
            row2 = cur.fetchone()
            if not row2:
                raise HTTPException(status_code=404, detail="Source code not found")
            disp = row2[0] or ""
            defi = row2[1] or ""
            query_text = disp if disp else defi
            if not query_text:
                # fallback to the code string itself
                query_text = str(source_code)

        if not query_text:
            raise HTTPException(status_code=400, detail="Provide either 'text' or a valid 'code'.")

        # Run semantic search over ICD-11 aliases
        results = semantic.semantic_search(conn=conn, q=query_text, top_k=req.limit, systems=req.target_systems)
        items = [
            SuggestItem(
                source_system=source_system,
                source_code=source_code,
                query_text=query_text or "",
                candidate_system=r["system"],
                candidate_code=r["code"],
                display=r.get("display", ""),
                score=float(r.get("score", 0.0)),
            )
            for r in results
        ]
        out = SuggestResponse(items=items)
        cache.set(cache_key, out, ttl_seconds=30)
        return out
    finally:
        conn.close()