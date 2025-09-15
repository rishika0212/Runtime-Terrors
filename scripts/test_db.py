# scripts/test_db.py
"""
Quick checks for the new relational schema:
- Tables: CodeSystem, Concept, ConceptMap
- Prints total counts and a few samples
"""
import sqlite3

DB_PATH = "db/terminology.db"

# Open with a busy timeout to avoid transient locks
conn = sqlite3.connect(DB_PATH, timeout=10)
conn.execute("PRAGMA foreign_keys = ON;")
cur = conn.cursor()

print("=== Table counts ===")
for tbl in ("CodeSystem", "Concept", "ConceptMap"):
    try:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        cnt = cur.fetchone()[0]
        print(f"{tbl}: {cnt}")
    except Exception as e:
        print(f"{tbl}: error -> {e}")

print("\n=== CodeSystems (url | title | version) ===")
try:
    cur.execute("SELECT url, COALESCE(title,''), COALESCE(version,'') FROM CodeSystem ORDER BY url LIMIT 10")
    for url, title, version in cur.fetchall():
        print(f"- {url} | {title} | {version}")
except Exception as e:
    print(f"Error reading CodeSystem: {e}")

print("\n=== Sample Concepts per CodeSystem ===")
try:
    cur.execute("SELECT id, url, COALESCE(title,'') FROM CodeSystem ORDER BY url LIMIT 5")
    for cs_id, url, title in cur.fetchall():
        print(f"\n-- {title or url} --")
        cur2 = conn.cursor()
        cur2.execute("SELECT code, COALESCE(display,''), COALESCE(definition,'') FROM Concept WHERE codesystem_id=? LIMIT 3", (cs_id,))
        rows = cur2.fetchall()
        if not rows:
            print("(no concepts)")
        for code, disp, defi in rows:
            print(f"  {code} | {disp[:80]}")
except Exception as e:
    print(f"Error reading concepts: {e}")

print("\n=== ConceptMap sample (top 10) ===")
try:
    cur.execute(
        """
        SELECT s.url, cm.source_code, t.url, cm.target_code, cm.mapping_type, COALESCE(cm.confidence,0)
        FROM ConceptMap cm
        JOIN CodeSystem s ON s.id = cm.source_codesystem_id
        JOIN CodeSystem t ON t.id = cm.target_codesystem_id
        LIMIT 10
        """
    )
    rows = cur.fetchall()
    if not rows:
        print("(no concept maps yet)")
    for s_url, s_code, t_url, t_code, mtype, conf in rows:
        print(f"{s_url}:{s_code} -> {t_url}:{t_code} [{mtype} {conf:.1f}]")
except Exception as e:
    print(f"Error reading ConceptMap: {e}")

conn.close()
print("\n✅ DB check complete")