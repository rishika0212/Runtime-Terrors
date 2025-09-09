import pandas as pd
import json
from pathlib import Path

# Adjusted paths for your structure
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "db" / "codesystems"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def csv_to_codesystem(file_path, system_url, title):
    df = pd.read_csv(file_path)

    codesystem = {
        "resourceType": "CodeSystem",
        "id": title.replace(" ", "-").lower(),
        "url": system_url,
        "version": "1.0.0",
        "name": title.replace(" ", ""),
        "title": title,
        "status": "active",
        "content": "complete",
        "concept": []
    }

    for _, row in df.iterrows():
        code = str(row.iloc[0])
        display = str(row.iloc[1])
        definition = str(row.iloc[2]) if len(row) > 2 else ""

        codesystem["concept"].append({
            "code": code,
            "display": display,
            "definition": definition
        })

    return codesystem

def main():
    mappings = {
        "ayurveda.csv": {
            "url": "http://namaste.gov.in/fhir/ayurveda",
            "title": "NATIONAL AYURVEDA MORBIDITY CODES"
        },
        "siddha.csv": {
            "url": "http://namaste.gov.in/fhir/siddha",
            "title": "NATIONAL SIDDHA MORBIDITY CODES"
        },
        "unani.csv": {
            "url": "http://namaste.gov.in/fhir/unani",
            "title": "NATIONAL UNANI MORBIDITY CODES"
        },
    }

    for csv_file, meta in mappings.items():
        codesystem = csv_to_codesystem(
            DATA_DIR / csv_file,
            meta["url"],
            meta["title"]
        )

        out_path = OUTPUT_DIR / f"{csv_file.replace('.csv', '')}_codesystem.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(codesystem, f, indent=2, ensure_ascii=False)

        print(f"✅ Generated {meta['title']} at {out_path}")

if __name__ == "__main__":
    main()
