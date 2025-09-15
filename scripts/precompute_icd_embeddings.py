# scripts/precompute_icd_embeddings.py
"""
Precompute sentence embeddings for ICD alias texts and cache them for fast retrieval.
- Reads ICD JSON files from db/icd11
- Extracts alias texts using logic consistent with step4 (title/synonym/indexTerm/inclusion/definition)
- Generates a single vector per ICD code by averaging alias vectors (simple, robust)
- Saves to db/embeddings/icd_alias_embeddings.npz with arrays: codes (object), vectors (float32)

Usage:
  python scripts/precompute_icd_embeddings.py --model sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

Notes:
- Requires sentence-transformers and numpy installed
- Run this once or when ICD cache changes
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

# Paths aligned with step4
ICD11_DIR = Path("db/icd11")
EMBED_DIR = Path("db/embeddings"); EMBED_DIR.mkdir(parents=True, exist_ok=True)

# Text normalization similar to step4 (minimal re-implementation to avoid import cycle)
import re
import unicodedata
try:
    from unidecode import unidecode as _unidecode
except Exception:
    _unidecode = None

def _normalize_text(s: str) -> str:
    if not s:
        return ""
    if _unidecode:
        try:
            s = _unidecode(s)
        except Exception:
            pass
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def _collect_texts(val) -> List[str]:
    out: List[str] = []
    def add_str(v):
        if isinstance(v, str):
            v = v.strip()
            if v:
                out.append(v)
    def walk(v):
        if v is None:
            return
        if isinstance(v, str):
            add_str(v)
        elif isinstance(v, list):
            for it in v:
                walk(it)
        elif isinstance(v, dict):
            if "@value" in v:
                walk(v.get("@value"))
            if "label" in v:
                walk(v.get("label"))
            if "title" in v:
                walk(v.get("title"))
            if "name" in v:
                walk(v.get("name"))
        else:
            add_str(str(v))
    walk(val)
    # Deduplicate
    seen = set(); res: List[str] = []
    for s in out:
        if s not in seen:
            seen.add(s)
            res.append(s)
    return res

def _iterate_icd_json_files():
    if not ICD11_DIR.exists():
        return []
    for p in ICD11_DIR.glob("*.json"):
        if p.name == "_roots.json":
            continue
        yield p

def build_icd_alias_map() -> Dict[str, List[str]]:
    index: Dict[str, List[str]] = {}
    for file in _iterate_icd_json_files():
        try:
            data = json.loads(Path(file).read_text(encoding="utf-8"))
        except Exception:
            continue
        code = data.get("code")
        if not code:
            continue
        labels: List[str] = []
        labels += _collect_texts(data.get("title"))
        for key in ("synonym", "indexTerm", "inclusion"):
            labels += _collect_texts(data.get(key))
        labels += _collect_texts(data.get("exclusion"))
        labels += _collect_texts(data.get("definition"))
        # Normalize duplicates collapsed
        dedup = []
        seen = set()
        for s in labels:
            s = str(s).strip()
            if not s:
                continue
            if s not in seen:
                seen.add(s)
                dedup.append(s)
            norm = _normalize_text(s)
            if norm and norm not in seen:
                seen.add(norm)
                dedup.append(norm)
        index[code] = dedup
    return index

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    args = parser.parse_args()

    try:
        import numpy as np
        from sentence_transformers import SentenceTransformer
    except Exception as e:
        print("Please install sentence-transformers and numpy: pip install sentence-transformers numpy")
        raise SystemExit(1)

    alias_map = build_icd_alias_map()
    if not alias_map:
        print("No ICD alias files found in db/icd11. Run step2_fetch_icd11.py first.")
        raise SystemExit(1)

    model = SentenceTransformer(args.model)

    codes = []
    vectors = []
    batch_texts = []
    batch_index = []

    def flush_batch():
        nonlocal batch_texts, batch_index
        if not batch_texts:
            return
        embs = model.encode(batch_texts, normalize_embeddings=True)
        import numpy as _np
        if isinstance(embs, list):
            embs = _np.array(embs, dtype=_np.float32)
        # Aggregate per code by averaging
        start = 0
        for code, cnt in batch_index:
            vec = embs[start:start+cnt].mean(axis=0)
            vectors.append(vec.astype('float32'))
            start += cnt
        batch_texts = []
        batch_index = []

    # Prepare batches per code
    for code, labels in alias_map.items():
        to_embed = labels[:64] if labels else []  # cap aliases to avoid huge sets
        if not to_embed:
            continue
        codes.append(code)
        batch_texts.extend(to_embed)
        batch_index.append((code, len(to_embed)))
        if len(batch_texts) >= 2048:
            flush_batch()
    flush_batch()

    if not vectors:
        print("No vectors produced.")
        raise SystemExit(1)

    vectors = np.stack(vectors, axis=0)
    np.savez_compressed(EMBED_DIR / "icd_alias_embeddings.npz", codes=np.array(codes, dtype=object), vectors=vectors.astype('float32'))
    print(f"Saved embeddings for {len(codes)} ICD codes to {EMBED_DIR / 'icd_alias_embeddings.npz'}")

if __name__ == "__main__":
    main()