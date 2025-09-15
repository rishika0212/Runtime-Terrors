# scripts/migrate_conceptmap_fk.py
"""
Rebuild ConceptMap table with composite foreign keys to Concept and proper indexes.
- Preserves existing data when possible (only rows with valid referenced concepts are kept).
- Safe to run multiple times.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path("db/terminology.db")

DDL = """
CREATE TABLE IF NOT EXISTS ConceptMap_tmp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_codesystem_id INTEGER NOT NULL,
    source_code TEXT NOT NULL,
    target_codesystem_id INTEGER NOT NULL,
    target_code TEXT NOT NULL,
    mapping_type TEXT NOT NULL,
    confidence REAL,
    FOREIGN KEY (source_codesystem_id) REFERENCES CodeSystem(id) ON DELETE CASCADE,
    FOREIGN KEY (target_codesystem_id) REFERENCES CodeSystem(id) ON DELETE CASCADE,
    FOREIGN KEY (source_codesystem_id, source_code)
        REFERENCES Concept(codesystem_id, code) ON DELETE CASCADE,
    FOREIGN KEY (target_codesystem_id, target_code)
        REFERENCES Concept(codesystem_id, code) ON DELETE CASCADE,
    UNIQUE(source_codesystem_id, source_code, target_codesystem_id, target_code)
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_concept_cs_code ON Concept(codesystem_id, code);
CREATE INDEX IF NOT EXISTS idx_concept_display ON Concept(display);
CREATE INDEX IF NOT EXISTS idx_cmap_src ON ConceptMap(source_codesystem_id, source_code);
CREATE INDEX IF NOT EXISTS idx_cmap_tgt ON ConceptMap(target_codesystem_id, target_code);
"""

def conceptmap_has_composite_fks(conn: sqlite3.Connection) -> bool:
    # Check if composite FKs exist by inspecting foreign keys; SQLite doesn't expose composite directly,
    # so we validate presence of both (source_codesystem_id, source_code) and (target_codesystem_id, target_code)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_key_list(ConceptMap);")
    rows = cur.fetchall()
    cols = {(r[3], r[4]) for r in rows}  # (from, to)
    return (
        ("source_codesystem_id", "codesystem_id") in cols and
        ("source_code", "code") in cols and
        ("target_codesystem_id", "codesystem_id") in cols and
        ("target_code", "code") in cols
    )


def migrate(conn: sqlite3.Connection):
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    if conceptmap_has_composite_fks(conn):
        print("ConceptMap already has composite FKs; ensuring indexes...")
        cur.executescript(INDEXES)
        conn.commit()
        return

    print("Rebuilding ConceptMap with composite FKs...")
    cur.execute("BEGIN;")
    # 1) Create temp table with correct schema
    cur.executescript(DDL)

    # 2) Copy valid rows only (that satisfy referential integrity)
    cur.execute(
        """
        INSERT OR IGNORE INTO ConceptMap_tmp (
            id, source_codesystem_id, source_code, target_codesystem_id, target_code, mapping_type, confidence
        )
        SELECT cm.id, cm.source_codesystem_id, cm.source_code, cm.target_codesystem_id, cm.target_code, cm.mapping_type, cm.confidence
        FROM ConceptMap cm
        JOIN Concept sc ON sc.codesystem_id = cm.source_codesystem_id AND sc.code = cm.source_code
        JOIN Concept tc ON tc.codesystem_id = cm.target_codesystem_id AND tc.code = cm.target_code
        """
    )

    # 3) Drop old and rename new
    cur.execute("DROP TABLE ConceptMap;")
    cur.execute("ALTER TABLE ConceptMap_tmp RENAME TO ConceptMap;")

    # 4) Recreate indexes
    cur.executescript(INDEXES)

    conn.commit()
    print("✅ ConceptMap migrated with composite FKs and indexes.")


if __name__ == "__main__":
    if not DB_PATH.exists():
        print("Error: db/terminology.db not found. Run step3_store_db.py first.")
    else:
        conn = sqlite3.connect(str(DB_PATH))
        try:
            migrate(conn)
        finally:
            conn.close()