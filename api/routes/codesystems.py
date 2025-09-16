# api/routes/codesystems.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..db import get_conn
from ..models import CodeSystemOut, ConceptOut, PaginatedConcepts
from ..cache import cache

router = APIRouter(prefix="/codesystems", tags=["CodeSystems"])


@router.get(
    "",
    response_model=list[CodeSystemOut],
    summary="List all CodeSystems",
    description="Returns metadata for all available CodeSystems (URL, name, title, version, status).",
)
def list_codesystems():
    cache_key = ("list_codesystems",)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT url, name, title, version, status FROM CodeSystem ORDER BY title COLLATE NOCASE")
        result = [CodeSystemOut(url=r[0], name=r[1], title=r[2], version=r[3], status=r[4]) for r in cur.fetchall()]
        cache.set(cache_key, result, ttl_seconds=60)
        return result
    finally:
        conn.close()


@router.get(
    "/{system_url:path}/{code}",
    response_model=ConceptOut,
    summary="Get a specific concept",
    description="Fetch a concept (code, display, definition) from a given CodeSystem. System may be URL, name, or title.",
)
def get_concept(system_url: str, code: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, url FROM CodeSystem WHERE url=?", (system_url,))
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT id, url FROM CodeSystem WHERE name=? OR title=?", (system_url, system_url))
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CodeSystem not found")
        cs_id, url = row[0], row[1]
        cur.execute(
            "SELECT code, COALESCE(display,''), COALESCE(definition,'') FROM Concept WHERE codesystem_id=? AND code=?",
            (cs_id, code),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Code not found")
        return ConceptOut(system=url, code=r[0], display=r[1], definition=r[2])
    finally:
        conn.close()


@router.get(
    "/{system_url:path}",
    response_model=PaginatedConcepts,
    summary="List concepts in a CodeSystem",
    description="Returns paginated concepts for a CodeSystem. Use limit/offset for pagination.",
)
def list_concepts(
    system_url: str,
    limit: int = Query(100, ge=1, le=500, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
):
    # Cache per system+pagination
    cache_key = ("list_concepts", system_url, limit, offset)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, url FROM CodeSystem WHERE url=?", (system_url,))
        row = cur.fetchone()
        if not row:
            # allow matching by name/title shortcut if URL not found
            cur.execute(
                "SELECT id, url FROM CodeSystem WHERE name=? OR title=?",
                (system_url, system_url),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CodeSystem not found")
        cs_id, url = row[0], row[1]

        # total count
        cur.execute("SELECT COUNT(1) FROM Concept WHERE codesystem_id=?", (cs_id,))
        total = int(cur.fetchone()[0])

        # page
        cur.execute(
            """
            SELECT code, COALESCE(display,''), COALESCE(definition,'')
            FROM Concept WHERE codesystem_id=?
            ORDER BY code
            LIMIT ? OFFSET ?
            """,
            (cs_id, limit, offset),
        )
        items = [ConceptOut(system=url, code=r[0], display=r[1], definition=r[2]) for r in cur.fetchall()]
        next_offset = offset + limit if (offset + limit) < total else None
        result = PaginatedConcepts(items=items, total=total, limit=limit, offset=offset, next_offset=next_offset)
        cache.set(cache_key, result, ttl_seconds=60)
        return result
    finally:
        conn.close()