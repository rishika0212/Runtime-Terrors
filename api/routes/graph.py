# api/routes/graph.py
from __future__ import annotations

from fastapi import APIRouter
from ..db import get_conn

router = APIRouter(prefix="/graph", tags=["Graph"])


@router.get("/overview")
def overview():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, url, COALESCE(title,name,url) AS label FROM CodeSystem")
        systems = {
            int(r[0]): {"id": int(r[0]), "url": str(r[1]), "label": str(r[2])}
            for r in cur.fetchall()
        }
        cur.execute(
            """
            SELECT source_codesystem_id, target_codesystem_id, COUNT(1) AS cnt
            FROM ConceptMap GROUP BY source_codesystem_id, target_codesystem_id
            """
        )
        edges = [
            {"source": int(r[0]), "target": int(r[1]), "count": int(r[2])}
            for r in cur.fetchall()
        ]
        return {"nodes": list(systems.values()), "links": edges}
    finally:
        conn.close()