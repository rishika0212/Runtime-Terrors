# api/db.py
from __future__ import annotations

import os
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Iterable, List, Optional

from dotenv import load_dotenv

try:
    from unidecode import unidecode as _unidecode
except Exception:
    _unidecode = None

load_dotenv()

# Allow overriding via env var; default to repo db/terminology.db
DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "db" / "terminology.db"
DB_PATH = Path(os.environ.get("TERMINOLOGY_DB", str(DEFAULT_DB_PATH)))


def _norm_text(s: Optional[str]) -> str:
    if not s:
        return ""
    try:
        if _unidecode:
            s = _unidecode(s)
    except Exception:
        pass
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def get_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise RuntimeError(f"terminology.db not found at {DB_PATH}. Run step3_store_db.py")
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    # Register normalization function for use in SQL WHERE/ORDER BY
    conn.create_function("NORM", 1, _norm_text)
    return conn


def get_codesystem_id(conn: sqlite3.Connection, system_url: str) -> Optional[int]:
    cur = conn.cursor()
    cur.execute("SELECT id FROM CodeSystem WHERE url=?", (system_url,))
    row = cur.fetchone()
    return int(row[0]) if row else None


def resolve_codesystem_ids(conn: sqlite3.Connection, systems: Optional[Iterable[str]]) -> List[int]:
    """Resolve a list of URL/name/title identifiers into CodeSystem IDs."""
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