# scripts/step3_store_db.py
"""
Build a relational terminology database with:
- CodeSystem (one row per distinct system)
- Concept (one row per concept per system)
- ConceptMap (mappings; populated in step 4)

Inputs:
- ICD-11 JSON cache under db/icd11 (created by step2_fetch_icd11.py)
- NAMASTE FHIR CodeSystem JSONs under db/codesystems (created by step2_generate_codesystems.py)

Outputs:
- SQLite DB at db/terminology.db fully populated with CodeSystem + Concept

Notes:
- Preserves original codes and labels without modification
- Uses foreign keys and uniqueness constraints to avoid duplicates
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Dict, Optional

DB_PATH = Path("db/terminology.db")
ICD11_DIR = Path("db/icd11")
CODESYSTEM_JSON_DIR = Path("db/codesystems")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# --- DB CONNECT ---
conn = sqlite3.connect(str(DB_PATH))
conn.execute("PRAGMA foreign_keys = ON;")
cursor = conn.cursor()

# --- SCHEMA ---
cursor.executescript(
    """
    CREATE TABLE IF NOT EXISTS CodeSystem (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        name TEXT,
        title TEXT,
        version TEXT,
        status TEXT
    );

    CREATE TABLE IF NOT EXISTS Concept (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codesystem_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        display TEXT,
        definition TEXT,
        FOREIGN KEY (codesystem_id) REFERENCES CodeSystem(id) ON DELETE CASCADE,
        UNIQUE(codesystem_id, code)
    );

    CREATE TABLE IF NOT EXISTS ConceptMap (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_codesystem_id INTEGER NOT NULL,
        source_code TEXT NOT NULL,
        target_codesystem_id INTEGER NOT NULL,
        target_code TEXT NOT NULL,
        mapping_type TEXT NOT NULL,
        confidence REAL,
        FOREIGN KEY (source_codesystem_id) REFERENCES CodeSystem(id) ON DELETE CASCADE,
        FOREIGN KEY (target_codesystem_id) REFERENCES CodeSystem(id) ON DELETE CASCADE,
        FOREIGN KEY (source_codesystem_id, source_code) REFERENCES Concept(codesystem_id, code) ON DELETE CASCADE,
        FOREIGN KEY (target_codesystem_id, target_code) REFERENCES Concept(codesystem_id, code) ON DELETE CASCADE,
        UNIQUE(source_codesystem_id, source_code, target_codesystem_id, target_code)
    );

    CREATE INDEX IF NOT EXISTS idx_concept_cs_code ON Concept(codesystem_id, code);
    CREATE INDEX IF NOT EXISTS idx_concept_display ON Concept(display);
    CREATE INDEX IF NOT EXISTS idx_cmap_src ON ConceptMap(source_codesystem_id, source_code);
    CREATE INDEX IF NOT EXISTS idx_cmap_tgt ON ConceptMap(target_codesystem_id, target_code);
    """
)
conn.commit()

# --- HELPERS ---

def upsert_codesystem(url: str, name: Optional[str] = None, title: Optional[str] = None,
                      version: Optional[str] = None, status: Optional[str] = None) -> int:
    cursor.execute("SELECT id FROM CodeSystem WHERE url=?", (url,))
    row = cursor.fetchone()
    if row:
        cs_id = row[0]
        # Update metadata if provided
        cursor.execute(
            "UPDATE CodeSystem SET name=COALESCE(?, name), title=COALESCE(?, title), version=COALESCE(?, version), status=COALESCE(?, status) WHERE id=?",
            (name, title, version, status, cs_id),
        )
        return cs_id
    cursor.execute(
        "INSERT INTO CodeSystem (url, name, title, version, status) VALUES (?, ?, ?, ?, ?)",
        (url, name, title, version, status),
    )
    return cursor.lastrowid


def insert_concept(codesystem_id: int, code: str, display: str = "", definition: str = ""):
    if not code:
        return
    try:
        cursor.execute(
            "INSERT OR IGNORE INTO Concept (codesystem_id, code, display, definition) VALUES (?, ?, ?, ?)",
            (codesystem_id, code, display, definition),
        )
        # For existing concepts, refresh display/definition when new non-empty values are provided
        cursor.execute(
            "UPDATE Concept SET display=COALESCE(NULLIF(?, ''), display), definition=COALESCE(NULLIF(?, ''), definition) WHERE codesystem_id=? AND code=?",
            (display, definition, codesystem_id, code),
        )
    except sqlite3.IntegrityError as e:
        print(f"Concept insert error for {code}: {e}")


# --- LOAD NAMASTE FHIR CodeSystem JSONs ---

def load_namaste_codesystems():
    if not CODESYSTEM_JSON_DIR.exists():
        print(f"Warning: {CODESYSTEM_JSON_DIR} not found. Run step2_generate_codesystems.py first.")
        return
    for json_file in sorted(CODESYSTEM_JSON_DIR.glob("*_codesystem.json")):
        try:
            with open(json_file, encoding="utf-8") as f:
                cs = json.load(f)
            if cs.get("resourceType") != "CodeSystem":
                print(f"Skipping non-CodeSystem file: {json_file}")
                continue
            url: str = cs.get("url", "")
            name: str = cs.get("name") or ""
            title: str = cs.get("title") or ""
            version: str = cs.get("version") or ""
            status: str = cs.get("status") or "active"
            if not url:
                print(f"Skipping {json_file}: missing url")
                continue
            cs_id = upsert_codesystem(url=url, name=name, title=title, version=version, status=status)
            count = 0
            for c in cs.get("concept", []) or []:
                insert_concept(cs_id, code=str(c.get("code", "")), display=str(c.get("display", "")), definition=str(c.get("definition", "")))
                count += 1
            print(f"✅ Inserted {count} concepts into {title} ({url})")
        except Exception as e:
            print(f"Error loading {json_file}: {e}")


# --- LOAD ICD-11 JSON CACHE ---

ICD_BIOMED_URL = "https://id.who.int/icd/release/11/2024-01/mms"

def _file_from_url(u: str) -> Path:
    last = u.rstrip("/").split("/")[-1]
    return ICD11_DIR / f"{last}.json"


def insert_icd11_tree(root_url: str, codesystem_url: str, name: str, title: str, version: str):
    """Load ICD-11 nodes from the local cache by walking child links starting at root.
    Optimizations:
    - Iterative traversal to avoid deep recursion
    - Batch commits for faster inserts
    - Progress logging
    """
    cs_id = upsert_codesystem(url=codesystem_url, name=name, title=title, version=version, status="active")

    from collections import deque

    seen: set[str] = set()
    q = deque([root_url])
    processed = 0

    while q:
        url = q.popleft()
        if url in seen:
            continue
        seen.add(url)
        file = _file_from_url(url)
        if not file.exists():
            continue
        try:
            with open(file, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        code = data.get("code")
        title_obj = data.get("title", {}) or {}
        display = title_obj.get("@value", "")
        definition = (data.get("definition", {}) or {}).get("@value", "")
        if code:
            insert_concept(cs_id, code=code, display=display, definition=definition)
            processed += 1
            if processed % 1000 == 0:
                conn.commit()
                print(f"   • Inserted {processed} concepts into {title}...")
        # enqueue children
        for child in (data.get("child", []) or []):
            if isinstance(child, str):
                q.append(child)

    conn.commit()
    print(f"✅ Inserted ICD-11 concepts for {title} ({codesystem_url}): {processed} concepts")


# --- MAIN ---
if __name__ == "__main__":
    # Clear existing concepts/maps but keep CodeSystem rows if re-runnable? We'll keep incremental behavior.
    # If a clean rebuild is desired, uncomment below lines.
    # cursor.execute("DELETE FROM ConceptMap"); cursor.execute("DELETE FROM Concept"); cursor.execute("DELETE FROM CodeSystem")
    # conn.commit()

    # 1) Load NAMASTE CodeSystem JSONs → CodeSystem + Concept
    load_namaste_codesystems()

    # 2) Load ICD-11 trees if cache exists
    roots_path = ICD11_DIR / "_roots.json"
    if not roots_path.exists():
        print("Warning: db/icd11/_roots.json not found. Run step2_fetch_icd11.py first.")
    else:
        with open(roots_path, encoding="utf-8") as f:
            roots = json.load(f)
        # Biomedicine
        insert_icd11_tree(
            root_url=roots.get("biomedicine_root", ICD_BIOMED_URL),
            codesystem_url=ICD_BIOMED_URL,
            name="ICD11MMS",
            title="ICD-11 MMS 2024-01 Biomedicine",
            version="2024-01",
        )
        # TM2
        tm2_root: Optional[str] = roots.get("tm2_root")
        if tm2_root:
            insert_icd11_tree(
                root_url=tm2_root,
                codesystem_url=tm2_root,  # use TM2 root URL as CodeSystem url anchor
                name="ICD11TM2",
                title="ICD-11 Traditional Medicine Module 2",
                version="2024-01",
            )
        else:
            print("Warning: TM2 root not found in _roots.json; TM2 concepts not loaded.")

    conn.commit()
    conn.close()
    print("✅ Database populated (CodeSystem + Concept). Run step4_generate_conceptmaps.py next.")