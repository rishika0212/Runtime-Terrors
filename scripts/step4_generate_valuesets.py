# scripts/step4_generate_valuesets.py

import sqlite3
import json
import re
from pathlib import Path
from datetime import datetime

DB_PATH = "db/terminology.db"
OUTPUT_DIR = Path("db/valuesets")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# FHIR ValueSet generator using CodeSystem/Concept schema

def slug_from_url(url: str) -> str:
    u = url.lower()
    if "namaste.gov.in" in u:
        if "ayurveda" in u:
            return "namaste-ayurveda"
        if "siddha" in u:
            return "namaste-siddha"
        if "unani" in u:
            return "namaste-unani"
        return "namaste"
    if "id.who.int/icd" in u:
        if "/mms" in u:
            return "icd-11-biomedicine"
        return "icd-11-tm2"
    # Fallback: sanitize full URL
    return re.sub(r"[^a-z0-9]+", "-", u).strip("-")


def build_valueset(cs_url: str, concepts: list[tuple[str, str]]):
    # concepts: list of (code, display)
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    slug = slug_from_url(cs_url)
    return {
        "resourceType": "ValueSet",
        "id": f"{slug}-valueset",
        "url": f"http://example.org/fhir/ValueSet/{slug}",
        "version": "1.0.0",
        "name": slug.replace("-", "").replace(" ", ""),
        "title": f"{slug} ValueSet",
        "status": "active",
        "date": now,
        "compose": {
            "include": [
                {
                    "system": cs_url,
                    "concept": [
                        {"code": c, "display": d} for c, d in concepts
                    ]
                }
            ]
        }
    }


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Fetch all CodeSystem URLs
    cur.execute("SELECT url FROM CodeSystem")
    systems = [row[0] for row in cur.fetchall() if row[0]]

    for cs_url in systems:
        cur.execute(
            """
            SELECT c.code, COALESCE(c.display, '')
            FROM Concept c
            JOIN CodeSystem s ON s.id = c.codesystem_id
            WHERE s.url = ?
            ORDER BY c.code
            """,
            (cs_url,)
        )
        concepts = cur.fetchall()
        vs = build_valueset(cs_url, concepts)
        slug = slug_from_url(cs_url)
        out_path = OUTPUT_DIR / f"{slug}_valueset.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(vs, f, indent=2, ensure_ascii=False)
        print(f"✅ Wrote ValueSet for {cs_url} to {out_path}")

    conn.close()


if __name__ == "__main__":
    main()