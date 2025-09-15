import json
from pathlib import Path
from typing import Optional, Sequence

import pandas as pd

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "db" / "codesystems"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# Preferred column names (case-insensitive) for each field
CODE_COLS: Sequence[str] = (
    "namc_code",
    "numc_code",  # Unani CSV support
    "code",
)
DISPLAY_COLS: Sequence[str] = (
    "namc_term",
    "numc_term",  # Unani CSV support
    "term",
    "display",
    "name",
)
# For definition, prefer Short_definition then Long_definition
DEFINITION_PRIORITY: Sequence[Sequence[str]] = (
    ("short_definition", "shortdef", "short definition"),
    ("long_definition", "longdef", "long definition", "definition"),
)


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lower-case columns and strip whitespace for reliable lookup."""
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _first_existing(df: pd.DataFrame, candidates: Sequence[str]) -> Optional[str]:
    """Return the first column name (from candidates) that exists in df (case-insensitive, already normalized)."""
    for c in candidates:
        if c in df.columns:
            return c
    return None


def _coalesce_definition(df: pd.DataFrame) -> pd.Series:
    """Coalesce definition from priority groups (first non-empty wins)."""
    # Start with empty string
    result = pd.Series(["" for _ in range(len(df))], index=df.index, dtype="string")

    for group in DEFINITION_PRIORITY:
        # Find first column from this group that exists
        col = _first_existing(df, group)
        if col is None:
            continue
        # Fill missing/empty only
        candidate = df[col].astype("string").fillna("").str.strip()
        result = result.mask(result.astype(str).str.len() > 0, result)  # keep already filled
        result = result.where(result.astype(str).str.len() > 0, candidate)  # fill empties

    return result.fillna("")


def _safe_series(df: pd.DataFrame, col: Optional[str]) -> pd.Series:
    if col and col in df.columns:
        return df[col].astype("string").fillna("").str.strip()
    # If column missing entirely, return empty series
    return pd.Series(["" for _ in range(len(df))], index=df.index, dtype="string")


def csv_to_codesystem(file_path: Path, system_url: str, title: str) -> dict:
    # Read CSV robustly — keep strings as-is
    df = pd.read_csv(file_path, dtype=str, keep_default_na=False, na_values=["", "NA", "NaN", "nan"])  # type: ignore
    df = _normalize_columns(df)

    # Try header-based mapping first
    code_col = _first_existing(df, CODE_COLS)
    display_col = _first_existing(df, DISPLAY_COLS)

    # Fallback to positional if needed
    if code_col is None and len(df.columns) >= 1:
        code_col = df.columns[0]
    if display_col is None and len(df.columns) >= 2:
        display_col = df.columns[1]

    code = _safe_series(df, code_col)
    display = _safe_series(df, display_col)
    definition = _coalesce_definition(df)

    # Drop rows where code or display is empty
    keep_mask = (code.str.len() > 0) & (display.str.len() > 0)
    df_out = pd.DataFrame({
        "code": code.where(keep_mask, None),
        "display": display.where(keep_mask, None),
        "definition": definition.where(keep_mask, ""),
    }).dropna(subset=["code", "display"]).reset_index(drop=True)

    # Deduplicate by code (keep first)
    df_out = df_out.drop_duplicates(subset=["code"], keep="first")

    # Optional: sort by code for stable output
    try:
        df_out = df_out.sort_values(by=["code"])  # if numeric-like codes appear, still fine as strings
    except Exception:
        pass

    codesystem = {
        "resourceType": "CodeSystem",
        "id": title.replace(" ", "-").lower(),
        "url": system_url,
        "version": "1.0.0",
        "name": title.replace(" ", ""),
        "title": title,
        "status": "active",
        "content": "complete",
        "caseSensitive": True,
        "concept": [],
    }

    for _, row in df_out.iterrows():
        entry = {
            "code": str(row["code"]),
            "display": str(row["display"]),
        }
        if str(row.get("definition", "")).strip():
            entry["definition"] = str(row["definition"])
        codesystem["concept"].append(entry)

    return codesystem


def main():
    mappings = {
        "ayurveda.csv": {
            "url": "http://namaste.gov.in/fhir/ayurveda",
            "title": "NATIONAL AYURVEDA MORBIDITY CODES",
        },
        "siddha.csv": {
            "url": "http://namaste.gov.in/fhir/siddha",
            "title": "NATIONAL SIDDHA MORBIDITY CODES",
        },
        "unani.csv": {
            "url": "http://namaste.gov.in/fhir/unani",
            "title": "NATIONAL UNANI MORBIDITY CODES",
        },
    }

    for csv_file, meta in mappings.items():
        in_path = DATA_DIR / csv_file
        if not in_path.exists():
            print(f"❌ Missing input CSV: {in_path}")
            continue

        codesystem = csv_to_codesystem(
            in_path,
            meta["url"],
            meta["title"],
        )

        out_path = OUTPUT_DIR / f"{csv_file.replace('.csv', '')}_codesystem.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(codesystem, f, indent=2, ensure_ascii=False)

        count = len(codesystem.get("concept", []))
        print(f"✅ Generated {meta['title']} at {out_path} (concepts: {count})")


if __name__ == "__main__":
    main()