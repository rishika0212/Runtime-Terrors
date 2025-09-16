# api/routes/search.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from ..db import get_conn, resolve_codesystem_ids
from ..models import SearchResult, PaginatedSearch
from ..cache import cache
from .. import semantic

router = APIRouter(tags=["Search"])  # no prefix to keep /search


@router.get(
    "/search",
    response_model=PaginatedSearch,
    summary="Search across all CodeSystems",
    description=(
        "Autocomplete-like search across all CodeSystems using normalization-aware LIKE (via NORM). "
        "Optional system filters and offset/limit pagination."
    ),
)
def global_search(
    q: str = Query(..., min_length=1, description="Search term"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    systems: Optional[List[str]] = Query(None, description="Optional list of CodeSystem identifiers (url/name/title) to restrict search"),
):
    cache_key = ("global_search", q, limit, offset, tuple(sorted(systems)) if systems else None)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        cur = conn.cursor()
        like = f"%{q}%"
        nlike = f"%{q}%"  # we apply NORM in SQL

        where = "(c.code LIKE ? OR c.display LIKE ? OR NORM(c.code) LIKE NORM(?) OR NORM(c.display) LIKE NORM(?))"
        params: list[object] = [like, like, nlike, nlike]

        cs_ids = resolve_codesystem_ids(conn, systems)
        if cs_ids:
            placeholders = ",".join(["?"] * len(cs_ids))
            where += f" AND c.codesystem_id IN ({placeholders})"
            params.extend(cs_ids)

        # total count
        cur.execute(
            f"""
            SELECT COUNT(1)
            FROM Concept c
            LEFT JOIN CodeSystem cs ON cs.id = c.codesystem_id
            WHERE {where}
            """,
            tuple(params),
        )
        total = int(cur.fetchone()[0])

        # page
        cur.execute(
            f"""
            SELECT cs.url AS system, c.code, COALESCE(c.display,''), COALESCE(c.definition,'')
            FROM Concept c
            JOIN CodeSystem cs ON cs.id = c.codesystem_id
            WHERE {where}
            ORDER BY c.code
            LIMIT ? OFFSET ?
            """,
            tuple(params + [limit, offset]),
        )
        rows = cur.fetchall()
        items = [
            SearchResult(system=r["system"], code=r["code"], display=r[2], definition=r[3], score=1.0)
            for r in rows
        ]
        next_offset = offset + limit if (offset + limit) < total else None
        result = PaginatedSearch(items=items, total=total, limit=limit, offset=offset, next_offset=next_offset)
        cache.set(cache_key, result, ttl_seconds=20)
        return result
    finally:
        conn.close()


@router.get(
    "/search/semantic",
    response_model=PaginatedSearch,
    summary="Semantic search over ICD-11 aliases (embeddings)",
    description=(
        "Find the most semantically similar ICD-11 codes using precomputed alias embeddings. "
        "Requires embeddings file (db/embeddings/icd_alias_embeddings.npz)."
    ),
)
def semantic_search(
    q: str = Query(..., min_length=1, description="Natural language query"),
    limit: int = Query(25, ge=1, le=100),
    systems: Optional[List[str]] = Query(None, description="Optional list of systems to prefer for display/definition (url/name/title)"),
):
    if not semantic.available():
        raise HTTPException(status_code=503, detail="Semantic search not available. Generate embeddings first.")

    cache_key = ("semantic_search", q, limit, tuple(sorted(systems)) if systems else None)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        results = semantic.semantic_search(conn=conn, q=q, top_k=limit, systems=systems)
        out_items = [SearchResult(**r) for r in results]
        result = PaginatedSearch(items=out_items, total=len(out_items), limit=limit, offset=0, next_offset=None)
        cache.set(cache_key, result, ttl_seconds=30)
        return result
    finally:
        conn.close()