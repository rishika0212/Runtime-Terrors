# api/main.py
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from dotenv import load_dotenv

DB_PATH = Path(__file__).resolve().parents[1] / "db" / "terminology.db"
load_dotenv()

app = FastAPI(title="Terminology API", version="0.1.0")

# --- Models ---
class ConceptOut(BaseModel):
    system: str
    code: str
    display: str = ""
    definition: str = ""

class ValueSetContains(BaseModel):
    system: str
    code: str
    display: str = ""

class ValueSetExpansion(BaseModel):
    resourceType: str = "ValueSet"
    status: str = "active"
    expansion: dict

# --- DB helpers ---

def get_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail="terminology.db not found. Run step3_store_db.py")
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

# --- Endpoints ---

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/concepts/search", response_model=List[ConceptOut])
def search_concepts(system: str = Query(..., description="CodeSystem URL"),
                    q: str = Query(..., min_length=1),
                    limit: int = Query(20, ge=1, le=100)):
    """Prefix/infix search on code and display, ranked crudely by position/length."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Resolve system -> codesystem_id
        cur.execute("SELECT id FROM CodeSystem WHERE url=?", (system,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CodeSystem not found")
        cs_id = row[0]
        like = f"%{q}%"
        cur.execute(
            """
            SELECT ?, c.code, COALESCE(c.display,''), COALESCE(c.definition,'')
            FROM Concept c
            WHERE c.codesystem_id=? AND (c.code LIKE ? OR c.display LIKE ?)
            LIMIT ?
            """,
            (system, cs_id, like, like, limit),
        )
        res = [ConceptOut(system=system, code=r[1], display=r[2], definition=r[3]) for r in cur.fetchall()]
        return res
    finally:
        conn.close()

@app.get("/valueset/expand", response_model=ValueSetExpansion)
def valueset_expand(system: str = Query(..., description="CodeSystem URL"),
                    filter: Optional[str] = Query(None, description="Search filter for contains"),
                    limit: int = Query(30, ge=1, le=200)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM CodeSystem WHERE url=?", (system,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CodeSystem not found")
        cs_id = row[0]
        if filter:
            like = f"%{filter}%"
            cur.execute(
                """
                SELECT c.code, COALESCE(c.display,'')
                FROM Concept c
                WHERE c.codesystem_id=? AND (c.code LIKE ? OR c.display LIKE ?)
                LIMIT ?
                """,
                (cs_id, like, like, limit),
            )
        else:
            cur.execute(
                "SELECT c.code, COALESCE(c.display,'') FROM Concept c WHERE c.codesystem_id=? LIMIT ?",
                (cs_id, limit),
            )
        contains = [ValueSetContains(system=system, code=r[0], display=r[1]).model_dump() for r in cur.fetchall()]
        return ValueSetExpansion(expansion={"contains": contains})
    finally:
        conn.close()

# Run with: uvicorn api.main:app --host 0.0.0.0 --port 8000