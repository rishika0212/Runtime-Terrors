# scripts/step3_store_db.py

import sqlite3
import json
import csv
from pathlib import Path

# --- CONFIG ---
DB_PATH = "db/terminology.db"
ICD11_DIR = Path("db/icd11")
NAMASTE_DIR = Path("data")
NAMASTE_FILES = ["ayurveda.csv", "siddha.csv", "unani.csv"]
ICD11_FILES = ["icd11_tm2.json", "icd11_biomedicine.json"]
CONCEPTMAP_DIR = Path("db/conceptmaps")  # Optional: if you have JSON mappings

# --- DATABASE CONNECTION ---
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# --- CREATE TABLES ---
cursor.execute("""
CREATE TABLE IF NOT EXISTS codesystem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system TEXT,
    code TEXT,
    display TEXT,
    definition TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS conceptmap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_system TEXT,
    source_code TEXT,
    target_system TEXT,
    target_code TEXT,
    mapping_type TEXT
)
""")

conn.commit()

# --- HELPER FUNCTIONS ---

def insert_codesystem_json(data, system_name):
    """
    Recursively insert codes from ICD11 JSONs (TM2/Biomedicine)
    """
    try:
        if "code" in data and "title" in data:
            code = data["code"]
            display = data["title"].get("@value", "")
            definition = data.get("definition", {}).get("@value", "")
            cursor.execute("""
                INSERT INTO codesystem (system, code, display, definition)
                VALUES (?, ?, ?, ?)
            """, (system_name, code, display, definition))
    except Exception as e:
        print(f"Error inserting concept {data.get('code')}: {e}")

    # Recursively process child concepts
    for child_url in data.get("child", []):
        child_file = ICD11_DIR / (child_url.split("/")[-1] + ".json")
        if child_file.exists():
            with open(child_file, encoding="utf-8") as cf:
                child_data = json.load(cf)
            insert_codesystem_json(child_data, system_name)

def insert_namaste_csv(file_name, system_name):
    """
    Insert NAMASTE CSV codes into codesystem table
    """
    try:
        with open(NAMASTE_DIR / file_name, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row.get("code") or row.get("Code") or ""
                display = row.get("term") or row.get("Term") or row.get("display") or ""
                definition = row.get("definition") or row.get("Definition") or ""
                if code:
                    cursor.execute("""
                        INSERT INTO codesystem (system, code, display, definition)
                        VALUES (?, ?, ?, ?)
                    """, (system_name, code, display, definition))
    except Exception as e:
        print(f"Error inserting NAMASTE file {file_name}: {e}")

def insert_conceptmap_json(file_path):
    """
    Insert ConceptMap JSON into conceptmap table
    Expected JSON format:
    [
        {
            "source_system": "NAMASTE-Ayurveda",
            "source_code": "NAM123",
            "target_system": "ICD-11-TM2",
            "target_code": "TM2-456",
            "mapping_type": "equivalent"
        },
        ...
    ]
    """
    if not Path(file_path).exists():
        return
    try:
        with open(file_path, encoding="utf-8") as f:
            mappings = json.load(f)
            for m in mappings:
                cursor.execute("""
                    INSERT INTO conceptmap (source_system, source_code, target_system, target_code, mapping_type)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    m.get("source_system"),
                    m.get("source_code"),
                    m.get("target_system"),
                    m.get("target_code"),
                    m.get("mapping_type")
                ))
    except Exception as e:
        print(f"Error inserting ConceptMap {file_path}: {e}")

# --- INSERT NAMASTE CODES ---
for file_name in NAMASTE_FILES:
    system_name = "NAMASTE-" + file_name.split(".")[0].capitalize()
    insert_namaste_csv(file_name, system_name)

# --- INSERT ICD-11 CODES ---
for file_name in ICD11_FILES:
    system_name = file_name.split(".")[0].upper().replace(".JSON","")
    file_path = ICD11_DIR / file_name
    if file_path.exists():
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)
        insert_codesystem_json(data, system_name)

# --- INSERT CONCEPTMAPS (OPTIONAL) ---
if CONCEPTMAP_DIR.exists():
    for map_file in CONCEPTMAP_DIR.glob("*.json"):
        insert_conceptmap_json(map_file)

# --- COMMIT AND CLOSE ---
conn.commit()
conn.close()
print("✅ Database populated successfully!")
