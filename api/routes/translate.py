# api/routes/translate.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import get_conn, get_codesystem_id
from ..models import TranslateRequest, TranslateResponse, Translation
from ..cache import cache

router = APIRouter(prefix="/translate", tags=["Translate"])


@router.post(
    "",
    response_model=TranslateResponse,
    summary="Translate a code between CodeSystems",
    description="Given a system and code, returns mapped target codes from ConceptMap, including reverse matches.",
)
def translate(req: TranslateRequest):
    cache_key = ("translate", req.system, req.code)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        cur = conn.cursor()
        src_cs_id = get_codesystem_id(conn, req.system)
        if src_cs_id is None:
            # allow matching by name/title shorthand
            cur.execute("SELECT id, url FROM CodeSystem WHERE name=? OR title=?", (req.system, req.system))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Source CodeSystem not found")
            src_cs_id = row[0]
        # Find all mappings where input appears as source OR target to support reverse lookup
        # 1) forward: source -> target
        cur.execute(
            """
            SELECT s.url AS source_system, cm.source_code, t.url AS target_system, cm.target_code, cm.mapping_type, cm.confidence
            FROM ConceptMap cm
            JOIN CodeSystem s ON s.id = cm.source_codesystem_id
            JOIN CodeSystem t ON t.id = cm.target_codesystem_id
            WHERE cm.source_codesystem_id = ? AND cm.source_code = ?
            """,
            (src_cs_id, req.code),
        )
        rows_fwd = cur.fetchall()

        # 2) reverse: target -> source
        cur.execute(
            """
            SELECT t.url AS source_system, cm.target_code AS source_code, s.url AS target_system, cm.source_code AS target_code, cm.mapping_type, cm.confidence
            FROM ConceptMap cm
            JOIN CodeSystem s ON s.id = cm.source_codesystem_id
            JOIN CodeSystem t ON t.id = cm.target_codesystem_id
            WHERE cm.target_codesystem_id = ? AND cm.target_code = ?
            """,
            (src_cs_id, req.code),
        )
        rows_rev = cur.fetchall()

        out = [
            Translation(
                source_system=r["source_system"],
                source_code=r["source_code"],
                target_system=r["target_system"],
                target_code=r["target_code"],
                mapping_type=r["mapping_type"],
                confidence=r["confidence"],
            )
            for r in rows_fwd
        ] + [
            Translation(
                source_system=r["source_system"],
                source_code=r["source_code"],
                target_system=r["target_system"],
                target_code=r["target_code"],
                mapping_type=r["mapping_type"],
                confidence=r["confidence"],
            )
            for r in rows_rev
        ]

        result = TranslateResponse(translations=out)
        cache.set(cache_key, result, ttl_seconds=60)
        return result
    finally:
        conn.close()