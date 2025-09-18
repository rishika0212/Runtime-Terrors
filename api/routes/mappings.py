from fastapi import APIRouter, Query
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional

mappings_router = APIRouter()

# File paths for each system
DATA_FILES = {
    "ayurveda": Path("db/conceptmaps/conceptmap_namaste-ayurveda.csv"),
    "siddha": Path("db/conceptmaps/conceptmap_namaste-siddha.csv"),
    "unani": Path("db/conceptmaps/conceptmap_namaste-unani.csv"),
}

# Cache in memory
MAPPINGS: Dict[str, List[Dict[str, Any]]] = {}


def load_csv_to_memory():
    """Load all CSVs into memory for faster access."""
    global MAPPINGS
    for system, file_path in DATA_FILES.items():
        rows = []
        if file_path.exists():
            with open(file_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows.extend(reader)
        MAPPINGS[system] = rows


# Load on startup
load_csv_to_memory()


@mappings_router.get("/conceptmaps")
def get_conceptmaps(
    search: Optional[str] = Query(None, description="Search text or code"),
    system: str = Query("all", description="ayurveda | siddha | unani | all"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Unified endpoint for frontend dashboard.
    Doctors can search in ayurveda / siddha / unani / all.
    """
    results: List[Dict[str, Any]] = []

    # Which systems to search
    systems_to_search = (
        list(MAPPINGS.keys())
        if system.lower() == "all"
        else [system.lower()] if system.lower() in MAPPINGS else []
    )

    for sys in systems_to_search:
        for row in MAPPINGS[sys]:
            src_disp = row.get("source_display", "") or ""
            tgt_disp = row.get("target_display", "") or ""
            src_code = row.get("source_code", "") or ""
            tgt_code = row.get("target_code", "") or ""

            # Apply filtering only if search is provided
            if search:
                if not (
                    search.lower() in src_disp.lower()
                    or search.lower() in tgt_disp.lower()
                    or search.lower() in src_code.lower()
                    or search.lower() in tgt_code.lower()
                ):
                    continue  # skip if no match

            results.append(
                {
                    "source_system": row.get("source_system", sys),
                    "source_code": src_code,
                    "target_system": row.get("target_system", ""),
                    "target_code": tgt_code,
                    "mapping_type": row.get("mapping_type", ""),
                    "confidence": row.get("confidence"),
                    "source_display": src_disp,
                    "target_display": tgt_disp,
                }
            )

    # Apply offset + limit
    sliced = results[offset : offset + limit]
    return {"count": len(results), "items": sliced}
