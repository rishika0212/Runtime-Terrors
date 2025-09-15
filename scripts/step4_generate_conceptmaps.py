# scripts/step4_generate_conceptmaps.py
"""
Generate accurate ConceptMaps from NAMASTE → ICD-11 (TM2 + Biomedicine).

Principles:
- Prefer WHO TM2 cross-reference data if available in the ICD-11 cache JSON.
- Otherwise, use curated lexical similarity:
  - Normalize strings (diacritics, punctuation, case)
  - Compare NAMASTE display/definition with ICD display + synonyms + index terms
  - Require token overlap and high composite similarity
- Emit FHIR R5 ConceptMap JSON per NAMASTE CodeSystem, grouped by ICD target systems
- Persist mappings to the database with confidence scores
- Produce a summary report with totals and unmapped codes
"""
from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from datetime import datetime
import argparse
import random

from rapidfuzz import fuzz, process
try:
    from rapidfuzz.distance import JaroWinkler as RFJaroWinkler
except Exception:
    RFJaroWinkler = None
try:
    from unidecode import unidecode as _unidecode
except Exception:
    _unidecode = None

# Optional progress bars
try:
    from tqdm import tqdm
except Exception:
    tqdm = lambda x, **k: x

# Optional numpy for embeddings cosine search
try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None  # will disable embeddings if not available

DB_PATH = Path("db/terminology.db")
ICD11_DIR = Path("db/icd11")
OUT_DIR = Path("db/conceptmaps")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# CodeSystem URLs (must match those inserted in step3)
NAMASTE_CS = {
    "NAMASTE-Ayurveda": "http://namaste.gov.in/fhir/ayurveda",
    "NAMASTE-Siddha": "http://namaste.gov.in/fhir/siddha",
    "NAMASTE-Unani": "http://namaste.gov.in/fhir/unani",
}
# Deterministic language tags per source system
NAMASTE_LANG_TAG = {
    "NAMASTE-Ayurveda": "hin_Deva",
    "NAMASTE-Siddha": "hin_Deva",
    "NAMASTE-Unani": "urd_Arab",
}
ICD_BIOMED_URL = "https://id.who.int/icd/release/11/2024-01/mms"

# Translation config
try:
    from scripts.indic_translation import IndicTranslator, detect_lang_tag
except Exception:
    # Fallback if running from project root
    from indic_translation import IndicTranslator, detect_lang_tag

TRANSLATE_TO_EN = True
# Global defaults (may be overridden per-system below or by CLI)
BACKTRANS_MIN_SIM = 70.0  # minimum round-trip similarity (0-100) to accept translation
ACCEPT_SCORE_THRESHOLD = 75.0  # acceptance threshold for legacy string score (0-100)
DRY_RUN_TRANSLATIONS = False
BATCH_SIZE = 32
BATCH_TRANSLATE = False
FAST_MODE = False  # aggressive filters for speed at slight recall tradeoff

# Per-system thresholds (initial tuning per plan)
PER_SYSTEM_BACKTRANS = {
    "NAMASTE-Ayurveda": 60.0,
    "NAMASTE-Siddha": 70.0,
    "NAMASTE-Unani": 70.0,
}
PER_SYSTEM_ACCEPT = {
    "NAMASTE-Ayurveda": 65.0,
    "NAMASTE-Siddha": 75.0,
    "NAMASTE-Unani": 75.0,
}

# Domain resources
SYN_DIR = Path("db/domain_synonyms"); SYN_DIR.mkdir(parents=True, exist_ok=True)
EMBED_DIR = Path("db/embeddings"); EMBED_DIR.mkdir(parents=True, exist_ok=True)

# Embeddings config (optional)
USE_EMBEDDINGS = False  # enable via CLI after precompute
EMBED_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
TOPK_EMBEDDINGS = 50

# In-memory holders for embedding resources (loaded lazily)
_EMB_MODEL = None
_EMB_CODES: List[str] | None = None
_EMB_MATRIX = None  # numpy ndarray if available

def _text_similarity(a: str, b: str) -> float:
    """Compute similarity on normalized strings using the same composite metric."""
    return _composite_score(_normalize_text(a or ""), _normalize_text(b or ""))

# Thresholds (relationship classification; interpreted on a 0-100 scale)
EQUIV_THRESHOLD = 90.0  # corresponds to final_score >= 0.90 when rescaled
RELATED_THRESHOLD = 70.0  # corresponds to 0.70 <= final_score < 0.90 when rescaled
MIN_TOKEN_OVERLAP = 0.30  # at least 30% of content tokens must overlap
CANDIDATE_THRESHOLD = 50.0  # review zone lower bound (0.50)
MAX_CANDIDATES_PER_SRC = 5


@dataclass
class ConceptEntry:
    code: str
    display: str
    definition: str


def _normalize_text(s: str) -> str:
    if not s:
        return ""
    # Transliterate non-Latin if possible (handles Sanskrit, Tamil, etc.)
    if _unidecode:
        try:
            s = _unidecode(s)
        except Exception:
            pass
    # Remove diacritics
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    # British/American variants and common medical variants
    variants = {
        "tumour": "tumor",
        "oedema": "edema",
        "haemorrhage": "hemorrhage",
        "haem": "hem",
        "anaemia": "anemia",
        "foetal": "fetal",
        "paediatric": "pediatric",
        "oesoph": "esoph",
    }
    for k, v in variants.items():
        s = re.sub(k, v, s, flags=re.IGNORECASE)
    # Lowercase and replace non-alnum with spaces (hyphens/punct to spaces)
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


STOPWORDS = {
    "the","and","with","without","of","in","on","to","for","from","by","at","or",
    "disease","disorder","syndrome","acute","chronic","unspecified","other","site","due","type",
}

def _tokens(s: str) -> List[str]:
    # Tokenize, drop very short tokens and stopwords, keep informative words
    toks = [t for t in _normalize_text(s).split() if len(t) >= 3]
    return [t for t in toks if t not in STOPWORDS]


def _token_overlap(a: Sequence[str], b: Sequence[str]) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    inter = len(sa & sb)
    denom = max(len(sa), len(sb))
    if denom == 0:
        return 0.0
    return inter / denom


def _composite_score(a: str, b: str) -> float:
    # Composite of WRatio and token_set_ratio for robustness
    s1 = fuzz.WRatio(a, b)
    s2 = fuzz.token_set_ratio(a, b)
    # Optional Jaro-Winkler for closer character-proximity match
    if RFJaroWinkler:
        try:
            s3 = 100.0 * (1.0 - RFJaroWinkler.normalized_distance(a, b))
        except Exception:
            s3 = (s1 + s2) / 2
        return 0.45 * s1 + 0.35 * s2 + 0.20 * s3
    return 0.6 * s1 + 0.4 * s2


def _jaccard(a: Sequence[str], b: Sequence[str]) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def _is_subset(a: Sequence[str], b: Sequence[str]) -> bool:
    # Is set(a) subset of set(b)?
    return set(a).issubset(set(b)) and len(a) < len(b)


def decide_relationship(nam_text: str, icd_primary: str, best_score: float) -> Optional[str]:
    """Heuristics to classify relationship per FHIR R5 codes.
    Returns one of: 'equivalent', 'source-is-narrower-than-target', 'source-is-broader-than-target', 'related-to', or None.

    NOTE: For now, `best_score` is the legacy composite string score (0-100). When
    semantic embeddings are enabled, we still compute this for interpretability
    and use final_score thresholds outside this function.
    """
    nam_norm = _normalize_text(nam_text)
    icd_norm = _normalize_text(icd_primary)
    nam_tokens = _tokens(nam_text)
    icd_tokens = _tokens(icd_primary)
    jac = _jaccard(nam_tokens, icd_tokens)

    # Strong exact/equivalent
    if best_score >= 96 or nam_norm == icd_norm or jac >= 0.9:
        return "equivalent"

    # Narrower: NAMASTE is more specific (contains ICD tokens plus qualifiers)
    if best_score >= 90 and _is_subset(icd_tokens, nam_tokens) and _token_overlap(nam_tokens, icd_tokens) >= 0.8:
        return "source-is-narrower-than-target"

    # Broader: NAMASTE is more general (subset of ICD primary tokens)
    if best_score >= 88 and _is_subset(nam_tokens, icd_tokens) and _token_overlap(nam_tokens, icd_tokens) >= 0.7:
        return "source-is-broader-than-target"

    # Related
    if best_score >= RELATED_THRESHOLD:
        return "related-to"

    # Otherwise skip
    return None


def load_codesystem_ids(conn) -> Dict[str, int]:
    cur = conn.cursor()
    ids: Dict[str, int] = {}
    # NAMASTE
    for name, url in NAMASTE_CS.items():
        cur.execute("SELECT id FROM CodeSystem WHERE url=?", (url,))
        row = cur.fetchone()
        if row:
            ids[url] = row[0]
    # ICD Biomed
    cur.execute("SELECT id FROM CodeSystem WHERE url=?", (ICD_BIOMED_URL,))
    row = cur.fetchone()
    if row:
        ids[ICD_BIOMED_URL] = row[0]
    # ICD TM2: attempt to read roots file to know TM2 root url (used as CodeSystem URL in step3)
    tm2_url: Optional[str] = None
    roots_path = ICD11_DIR / "_roots.json"
    if roots_path.exists():
        with open(roots_path, encoding="utf-8") as f:
            roots = json.load(f)
        tm2_url = roots.get("tm2_root")
    if tm2_url:
        cur.execute("SELECT id FROM CodeSystem WHERE url=?", (tm2_url,))
        row = cur.fetchone()
        if row:
            ids[tm2_url] = row[0]
    return ids


def get_codesystem_versions(conn) -> Dict[str, str]:
    cur = conn.cursor()
    cur.execute("SELECT url, COALESCE(version,'') FROM CodeSystem")
    return {url: ver for url, ver in cur.fetchall()}


def load_concepts(conn, cs_url: str) -> List[ConceptEntry]:
    cur = conn.cursor()
    cur.execute(
        "SELECT code, COALESCE(display,''), COALESCE(definition,'') FROM Concept c\n         JOIN CodeSystem s ON s.id=c.codesystem_id\n         WHERE s.url=?",
        (cs_url,),
    )
    return [ConceptEntry(code, disp, defi) for code, disp, defi in cur.fetchall()]


def _ensure_translation_cache(conn):
    cur = conn.cursor()
    try:
        cur.execute(
            "CREATE TABLE IF NOT EXISTS TranslationCache (\n               codesystem_id INTEGER,\n               code TEXT,\n               en_joined TEXT,\n               src_lang TEXT,\n               back_sim REAL,\n               PRIMARY KEY (codesystem_id, code)\n             )"
        )
    except Exception:
        pass
    conn.commit()


def _load_cached_translations(conn, cs_url: str) -> Dict[str, Tuple[str, str, float]]:
    """Return code -> (en_joined, src_lang, back_sim)."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM CodeSystem WHERE url=?", (cs_url,))
    row = cur.fetchone()
    if not row:
        return {}
    cs_id = row[0]
    cur.execute("SELECT code, COALESCE(en_joined,''), COALESCE(src_lang,'eng_Latn'), COALESCE(back_sim,0.0) FROM TranslationCache WHERE codesystem_id=?", (cs_id,))
    return {code: (en, lang, float(sim or 0.0)) for code, en, lang, sim in cur.fetchall()}


def _upsert_cached_translation(conn, cs_url: str, code: str, en_joined: str, src_lang: str, back_sim: float):
    cur = conn.cursor()
    cur.execute("SELECT id FROM CodeSystem WHERE url=?", (cs_url,))
    row = cur.fetchone()
    if not row:
        return
    cs_id = row[0]
    cur.execute(
        "INSERT INTO TranslationCache (codesystem_id, code, en_joined, src_lang, back_sim) VALUES (?, ?, ?, ?, ?)\n         ON CONFLICT(codesystem_id, code) DO UPDATE SET en_joined=excluded.en_joined, src_lang=excluded.src_lang, back_sim=excluded.back_sim",
        (cs_id, code, en_joined, src_lang, float(back_sim or 0.0)),
    )
    conn.commit()


def iterate_icd_json_files() -> Iterable[Path]:
    if not ICD11_DIR.exists():
        return []
    for p in ICD11_DIR.glob("*.json"):
        # skip roots metadata
        if p.name == "_roots.json":
            continue
        yield p


def build_icd_alias_index() -> Dict[str, List[str]]:
    """Map ICD code -> list of aliases (display + synonyms + index terms + inclusions).
    Uses a simple on-disk cache to avoid rebuilding when the ICD JSONs haven't changed.
    """

    def _collect_texts(val) -> List[str]:
        """Extract human-readable strings from mixed ICD JSON structures (str | dict | list)."""
        out: List[str] = []

        def add_str(s):
            if isinstance(s, str):
                s = s.strip()
                if s:
                    out.append(s)

        def walk(v):
            if v is None:
                return
            if isinstance(v, str):
                add_str(v)
            elif isinstance(v, list):
                for item in v:
                    walk(item)
            elif isinstance(v, dict):
                # Common patterns: {"@value": ".."}, {"label": ".."}, {"label": {"@value": ".."}}
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
        # Deduplicate while preserving order
        seen_local = set()
        res: List[str] = []
        for s in out:
            if s not in seen_local:
                seen_local.add(s)
                res.append(s)
        return res

    # Determine cache freshness (based on latest mtime and file count)
    cache_path = EMBED_DIR / "icd_alias_index.json"
    latest_mtime = 0.0
    file_count = 0
    for p in iterate_icd_json_files():
        try:
            mt = p.stat().st_mtime
            if mt > latest_mtime:
                latest_mtime = mt
            file_count += 1
        except Exception:
            continue

    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            meta = payload.get("_meta", {})
            if (
                abs(float(meta.get("latest_mtime", 0.0)) - float(latest_mtime)) < 1e-6
                and int(meta.get("file_count", 0)) == int(file_count)
                and isinstance(payload.get("index"), dict)
            ):
                # Cache hit
                return {k: list(v) for k, v in payload["index"].items()}
        except Exception:
            pass

    # Build fresh index
    index: Dict[str, List[str]] = defaultdict(list)
    files = list(iterate_icd_json_files())
    for file in tqdm(files, desc="Building ICD alias index", unit="file"):
        try:
            with open(file, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        code = data.get("code")
        if not code:
            continue
        labels: List[str] = []
        # Title
        labels += _collect_texts(data.get("title"))
        # synonyms, indexTerm, inclusion
        for key in ("synonym", "indexTerm", "inclusion"):
            labels += _collect_texts(data.get(key))
        # exclusions sometimes useful
        labels += _collect_texts(data.get("exclusion"))
        # definitions add valuable English equivalents
        labels += _collect_texts(data.get("definition"))
        # Dedup but keep order; also keep a normalized variant alongside originals
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

    # Save cache for future runs
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump({
                "_meta": {"latest_mtime": latest_mtime, "file_count": file_count},
                "index": index,
            }, f)
    except Exception:
        pass

    return index


def _maybe_translate(text: str, translator: IndicTranslator | None, src_tag: str | None) -> tuple[str, str, float]:
    """Translate Indic text to English using IndicTrans2 with round-trip check.
    Returns (english_text, src_tag_used, backtrans_sim). If translation is not enabled
    or not needed, returns (original_text, 'eng_Latn', 100.0).
    """
    if not TRANSLATE_TO_EN or not text:
        return text, "eng_Latn", 100.0
    if translator is None:
        return text, "eng_Latn", 100.0
    tag = src_tag or "eng_Latn"
    if tag == "eng_Latn":
        return text, tag, 100.0
    en = translator.translate(text, src_lang=tag, tgt_lang="eng_Latn")
    if not en:
        return text, tag, 0.0
    # Back-translate for validation
    back = translator.translate(en, src_lang="eng_Latn", tgt_lang=tag)
    sim = _text_similarity(text, back)
    return (en, tag, sim)


def _get_system_thresholds(source_name: str) -> Tuple[float, float]:
    """Return (back_min, accept_min) applying per-system config if enabled."""
    use_per_system = globals().get("USE_PER_SYSTEM", False)
    back_min = PER_SYSTEM_BACKTRANS.get(source_name, BACKTRANS_MIN_SIM) if use_per_system else BACKTRANS_MIN_SIM
    accept_min = PER_SYSTEM_ACCEPT.get(source_name, ACCEPT_SCORE_THRESHOLD) if use_per_system else ACCEPT_SCORE_THRESHOLD
    return float(back_min), float(accept_min)


def _load_system_synonyms(source_name: str) -> Dict[str, str]:
    """Load domain synonym mapping for system (lowercased normalized keys).
    Expected files: db/domain_synonyms/ayurveda_synonyms.json, siddha_synonyms.json, unani_synonyms.json
    """
    sys_key = (source_name.split('-', 1)[-1].lower() if '-' in source_name else source_name.lower())
    fname = {
        'namaste-ayurveda': 'ayurveda_synonyms.json',
        'ayurveda': 'ayurveda_synonyms.json',
        'namaste-siddha': 'siddha_synonyms.json',
        'siddha': 'siddha_synonyms.json',
        'namaste-unani': 'unani_synonyms.json',
        'unani': 'unani_synonyms.json',
    }.get(sys_key, f"{sys_key}_synonyms.json")
    mapping: Dict[str, str] = {}
    try:
        p = SYN_DIR / fname
        if p.exists():
            with open(p, encoding='utf-8') as f:
                raw = json.load(f)
            for k, v in (raw.items() if isinstance(raw, dict) else []):
                mapping[_normalize_text(k)] = v
    except Exception:
        pass
    return mapping


# --- Embeddings helpers ---

def _ensure_embed_model():
    global _EMB_MODEL
    if _EMB_MODEL is not None:
        return True
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        _EMB_MODEL = SentenceTransformer(EMBED_MODEL_NAME)
        return True
    except Exception:
        _EMB_MODEL = None
        return False


def _load_icd_embeddings() -> bool:
    """Load precomputed ICD alias embeddings from EMBED_DIR if available.
    Expect file icd_alias_embeddings.npz with arrays: codes (object), vectors (float32).
    """
    global _EMB_CODES, _EMB_MATRIX
    if _EMB_CODES is not None and _EMB_MATRIX is not None:
        return True
    if np is None:
        return False
    path = EMBED_DIR / "icd_alias_embeddings.npz"
    if not path.exists():
        return False
    try:
        npz = np.load(path, allow_pickle=True)
        codes = npz.get('codes')
        vecs = npz.get('vectors')
        if codes is None or vecs is None:
            return False
        # Normalize vectors for cosine
        vecs = vecs.astype(np.float32)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vecs = vecs / norms
        _EMB_CODES = list(codes.tolist())
        _EMB_MATRIX = vecs
        return True
    except Exception:
        return False


def _embed_query(text: str):
    if not text:
        return None
    if not _ensure_embed_model():
        return None
    try:
        vec = _EMB_MODEL.encode([text], normalize_embeddings=True)
        if isinstance(vec, list):
            # sentence-transformers older versions may return list
            vec = np.array(vec, dtype=np.float32)
        return vec[0]
    except Exception:
        return None


def _shortlist_by_embeddings(en_text: str) -> Optional[List[str]]:
    if not USE_EMBEDDINGS:
        return None
    if not _load_icd_embeddings():
        return None
    q = _embed_query(en_text)
    if q is None or _EMB_MATRIX is None or _EMB_CODES is None or np is None:
        return None
    sims = (_EMB_MATRIX @ q.reshape(-1, 1)).ravel()  # cosine if rows are normalized
    top_idx = sims.argsort()[-TOPK_EMBEDDINGS:][::-1]
    return [_EMB_CODES[i] for i in top_idx]


def find_best_matches(nam: ConceptEntry, icd_aliases: Dict[str, List[str]], top_k: int = 5, translator: IndicTranslator | None = None, src_lang_tag: str | None = None) -> List[Tuple[str, str, float, dict]]:
    """Return list of (icd_code, best_label, score, meta) sorted by score desc.
    Meta includes: {"src_text", "src_lang", "en_text", "back_sim"}
    The returned score is on 0–100 scale. If embeddings are enabled, it is final_score*100.
    """
    src_texts = [nam.display]
    if nam.definition:
        src_texts.append(nam.definition)
    src_join = "; ".join(t for t in src_texts if t)
    if not src_join:
        return []

    # Translate to English using deterministic lang tag for this source
    en_text, src_lang, back_sim = _maybe_translate(src_join, translator, src_lang_tag)

    nam_norm = _normalize_text(en_text)
    nam_tokens = _tokens(en_text)

    # Optional embeddings shortlist
    shortlist_codes = _shortlist_by_embeddings(en_text) if USE_EMBEDDINGS else None

    results: List[Tuple[str, str, float, dict]] = []
    # Iterate either all codes or shortlisted
    iterable = ((c, icd_aliases.get(c, [])) for c in shortlist_codes) if shortlist_codes else icd_aliases.items()
    for icd_code, labels in iterable:
        if not labels:
            continue
        icd_primary = labels[0]
        if not shortlist_codes:
            # Fast prefilters to avoid heavy scoring on unlikely codes
            tok_overlap = _token_overlap(nam_tokens, _tokens(icd_primary))
            if FAST_MODE and tok_overlap < max(MIN_TOKEN_OVERLAP, 0.5):
                continue
            if tok_overlap < MIN_TOKEN_OVERLAP:
                quick = fuzz.WRatio(nam_norm, _normalize_text(icd_primary))
                if quick < (92 if FAST_MODE else 90):
                    continue
        best = 0.0
        best_label = ""
        # In fast mode, cap labels more aggressively
        label_cap = 20 if FAST_MODE else 50
        for lb in labels[:label_cap]:
            lb_norm = _normalize_text(lb)
            score = _composite_score(nam_norm, lb_norm)
            if score > best:
                best = score
                best_label = lb
        if best_label:
            # If using embeddings, compute final score (scale to 0-100)
            if shortlist_codes:
                semantic_component = 1.0  # shortlist already enforces semantic closeness; set to max
                final_score = 100.0 * (0.5 * semantic_component + 0.35 * (best / 100.0) + 0.15 * (float(back_sim or 0.0) / 100.0))
                decision_score = final_score
            else:
                decision_score = best
            results.append((icd_code, best_label, float(decision_score), {
                "src_text": src_join,
                "src_lang": src_lang,
                "en_text": en_text,
                "back_sim": back_sim,
            }))
    results.sort(key=lambda x: x[2], reverse=True)
    return results[: max(top_k * 20, 50)]


def map_system(conn, source_name: str, source_url: str, icd_targets: List[Tuple[str, str]]):
    """Map one NAMASTE system to ICD targets.
    icd_targets: list of (title, url)
    """
    # Load NAMASTE concepts
    source_concepts = load_concepts(conn, source_url)

    # Apply per-system thresholds if enabled
    back_min, accept_min = _get_system_thresholds(source_name)

    # Translator (lazy init): only if translation enabled
    translator = IndicTranslator() if TRANSLATE_TO_EN else None
    # explicit device selection
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Translation device: {device}")
    translator = IndicTranslator(device=device) if TRANSLATE_TO_EN else None


    # Build alias indices once
    print("   • Building ICD alias index (this can take a minute)...")
    icd_aliases_full = build_icd_alias_index()
    print(f"   • ICD alias index ready: {len(icd_aliases_full)} ICD codes")

    # Load domain synonyms (optional)
    sys_synonyms = _load_system_synonyms(source_name)

    # Build set of codes existing in DB for each target URL (to avoid mapping to concepts not inserted)
    target_code_sets: Dict[str, set] = {}
    for t_title, t_url in icd_targets:
        codes = set(c.code for c in load_concepts(conn, t_url))
        target_code_sets[t_url] = codes
        print(f"   • Target '{t_title}' codes in DB: {len(codes)}")

    # Prepare mapping accumulators
    mappings_per_target: Dict[str, List[dict]] = {t_url: [] for _, t_url in icd_targets}
    unmapped: List[str] = []

    # Optional dry-run: collect only translation audits
    if DRY_RUN_TRANSLATIONS:
        # Use batch mode in dry-run too for speed and progress
        print("   • Preparing translation audit (dry-run) ...")
        audits = []
        src_tag = NAMASTE_LANG_TAG.get(source_name)
        items = []
        for nam in source_concepts:
            parts = [nam.display]
            if nam.definition:
                parts.append(nam.definition)
            src_join = "; ".join(t for t in parts if t)
            items.append((nam.code, src_join))
        # Apply synonyms and split untranslated items
        to_translate = []
        for code, src_join in items:
            norm_src = _normalize_text(src_join)
            if norm_src in sys_synonyms:
                en_text = sys_synonyms[norm_src]
                audits.append({
                    "code": code,
                    "src_lang": src_tag or "eng_Latn",
                    "source_text": src_join,
                    "translated_text": en_text,
                    "backtranslation_similarity": 100.0,
                    "note": "whitelisted",
                })
            else:
                to_translate.append((code, src_join))
        # Translate in batches with progress
        codes = [c for c, _ in to_translate]
        texts = [t for _, t in to_translate]
        en_list = []
        back_list = []
        if TRANSLATE_TO_EN and translator is not None and texts:
            for i in tqdm(range(0, len(texts), BATCH_SIZE), desc="Dry-run: forward translate", unit="batch"):
                chunk = texts[i:i+BATCH_SIZE]
                en_list.extend(translator.batch_translate(chunk, src_lang=src_tag or "eng_Latn", tgt_lang="eng_Latn", batch_size=BATCH_SIZE))
            for i in tqdm(range(0, len(en_list), BATCH_SIZE), desc="Dry-run: back translate", unit="batch"):
                chunk = en_list[i:i+BATCH_SIZE]
                back_list.extend(translator.batch_translate(chunk, src_lang="eng_Latn", tgt_lang=src_tag or "eng_Latn", batch_size=BATCH_SIZE))
        # Collate
        for idx, code in enumerate(codes):
            src_join = texts[idx]
            en_text = en_list[idx] if idx < len(en_list) else src_join
            back_text = back_list[idx] if idx < len(back_list) else src_join
            sim = _text_similarity(src_join, back_text) if (src_tag and src_tag != "eng_Latn") else 100.0
            audits.append({
                "code": code,
                "src_lang": src_tag or "eng_Latn",
                "source_text": src_join,
                "translated_text": en_text,
                "backtranslation_similarity": round(float(sim or 0.0), 2),
            })
        # Save audits to file and return empty mappings
        audit_path = OUT_DIR / f"_translation_audit_{source_name.replace(' ', '_').lower()}.json"
        with open(audit_path, "w", encoding="utf-8") as f:
            json.dump(audits, f, indent=2, ensure_ascii=False)
        print(f"📝 Wrote translation audit for {source_name} to {audit_path}")
        return mappings_per_target, [a["code"] for a in audits if (a.get("backtranslation_similarity") or 0.0) < back_min]

    # If batch mode, pre-translate all texts once
    pre_en_text: Dict[str, str] = {}
    pre_src_lang: Dict[str, str] = {}
    pre_back_sim: Dict[str, float] = {}
    if TRANSLATE_TO_EN and BATCH_TRANSLATE and translator is not None:
        print("   • Batch translating NAMASTE texts...")
        # Prepare inputs per concept
        src_tag = NAMASTE_LANG_TAG.get(source_name)
        # Translation cache table
        _ensure_translation_cache(conn)
        cached = _load_cached_translations(conn, source_url)
        joined_texts = []
        codes = []
        for nam in source_concepts:
            parts = [nam.display]
            if nam.definition:
                parts.append(nam.definition)
            joined = "; ".join(t for t in parts if t)
            # Check synonyms whitelist
            norm_src = _normalize_text(joined)
            if norm_src in sys_synonyms:
                en = sys_synonyms[norm_src]
                pre_en_text[nam.code] = en
                pre_src_lang[nam.code] = src_tag or "eng_Latn"
                pre_back_sim[nam.code] = 100.0  # trusted override
                continue
            # Check DB cache
            if nam.code in cached and cached[nam.code][0]:
                en_cached, lang_cached, sim_cached = cached[nam.code]
                pre_en_text[nam.code] = en_cached
                pre_src_lang[nam.code] = lang_cached or (src_tag or "eng_Latn")
                pre_back_sim[nam.code] = float(sim_cached or 0.0)
                continue
            # Queue for translation
            codes.append(nam.code)
            joined_texts.append(joined)
        # Forward translate in batches
        en_list = translator.batch_translate(joined_texts, src_lang=src_tag or "eng_Latn", tgt_lang="eng_Latn", batch_size=BATCH_SIZE) if joined_texts else []
        # Back translate in batches for validation
        back_list = translator.batch_translate(en_list, src_lang="eng_Latn", tgt_lang=src_tag or "eng_Latn", batch_size=BATCH_SIZE) if en_list else []
        for code, src_text, en_text, back_text in zip(codes, joined_texts, en_list, back_list):
            sim = _text_similarity(src_text, back_text) if (src_tag and src_tag != "eng_Latn") else 100.0
            pre_en_text[code] = en_text
            pre_src_lang[code] = src_tag or "eng_Latn"
            pre_back_sim[code] = sim
            # Persist to cache
            _upsert_cached_translation(conn, source_url, code, en_text, src_tag or "eng_Latn", sim)
        print("   • Batch translation complete.")

    # Mapping mode
    review_rows: List[dict] = []
    for i, nam in enumerate(tqdm(source_concepts, desc=f"Mapping {source_name}", unit="concept"), 1):
        if i % 100 == 0:
            print(f"     - Processed {i}/{len(source_concepts)} source concepts", flush=True)
        found_any = False
        if TRANSLATE_TO_EN and BATCH_TRANSLATE and translator is not None:
            # Use precomputed
            en_text = pre_en_text.get(nam.code) or f"{nam.display}; {nam.definition}".strip("; ")
            src_lang = pre_src_lang.get(nam.code, NAMASTE_LANG_TAG.get(source_name, "eng_Latn"))
            back_sim = pre_back_sim.get(nam.code, 100.0)
            # Build a temporary ConceptEntry-like view with the English text for matching
            temp = ConceptEntry(code=nam.code, display=en_text, definition="")
            matches = find_best_matches(temp, icd_aliases_full, translator=None, src_lang_tag="eng_Latn")
            # Inject meta from pretranslation into match metas
            matches = [
                (code, label, score, {**meta, "src_lang": src_lang, "en_text": en_text, "back_sim": back_sim})
                for (code, label, score, meta) in matches
            ]
        else:
            matches = find_best_matches(nam, icd_aliases_full, translator=translator, src_lang_tag=NAMASTE_LANG_TAG.get(source_name))
        # capture top 5 for review where needed
        top5_all = matches[:5]
        for _, t_url in icd_targets:
            t_codes = target_code_sets.get(t_url, set())
            best_here = [m for m in matches if m[0] in t_codes]
            if not best_here:
                continue
            top_code, top_label, top_score, meta = best_here[0]
            # Backtranslation threshold (per-system aware)
            if TRANSLATE_TO_EN and meta.get("src_lang") != "eng_Latn" and meta.get("back_sim", 0.0) < back_min:
                # Allow if whitelisted synonym matched exactly
                norm_src = _normalize_text(meta.get("src_text", ""))
                if norm_src not in sys_synonyms:
                    continue
            # Acceptance threshold (per-system aware)
            if top_score < accept_min:
                # If borderline (0.50–0.85), include in review CSV
                if 50.0 <= float(top_score) <= 85.0:
                    review_rows.append({
                        "source_code": nam.code,
                        "source_display": nam.display,
                        "translated_text": meta.get("en_text", ""),
                        "back_sim": meta.get("back_sim", 0.0),
                        "candidates": [(c, l, s) for (c, l, s, _m) in top5_all],
                        "suggested_relationship": "related-to" if float(top_score) >= 70.0 else "review",
                        "final_score": float(top_score),
                    })
                continue
            icd_primary = icd_aliases_full.get(top_code, [top_label])[0]
            rel = decide_relationship(
                (en_text if (TRANSLATE_TO_EN and BATCH_TRANSLATE and translator is not None) else (meta.get("en_text") or f"{nam.display}; {nam.definition}".strip("; "))),
                icd_primary,
                top_score,
            )
            if not rel:
                continue
            mappings_per_target[t_url].append({
                "source_code": nam.code,
                "source_display": nam.display,
                "target_code": top_code,
                "target_display": top_label,
                "mapping_type": rel,
                "confidence": round(float(top_score), 2),
                "src_lang": (src_lang if (TRANSLATE_TO_EN and BATCH_TRANSLATE and translator is not None) else meta.get("src_lang", "eng_Latn")),
                "translated_text": (en_text if (TRANSLATE_TO_EN and BATCH_TRANSLATE and translator is not None) else meta.get("en_text", "")),
                "backtranslation_similarity": round(float((back_sim if (TRANSLATE_TO_EN and BATCH_TRANSLATE and translator is not None) else meta.get("back_sim", 0.0))), 2),
            })
            found_any = True
        if not found_any:
            unmapped.append(nam.code)

    # Emit review CSV if requested
    if globals().get("args_emit_review_csv", False) and review_rows:
        write_review_csv(source_name, review_rows)

    return mappings_per_target, unmapped


def write_fhir_conceptmap(source_name: str, source_url: str,
                          groups: List[Tuple[str, str, List[dict]]]) -> Path:
    """Write a FHIR R5 ConceptMap with groups per target system.
    groups: list of (target_title, target_url, mappings)
    """
    cm = {
        "resourceType": "ConceptMap",
        "status": "active",
        "name": f"{source_name.replace('-', '')}ToICD11",
        "title": f"{source_name} to ICD-11 Mapping",
        "date": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "group": [],
    }
    for tgt_title, tgt_url, maps in groups:
        if not maps:
            continue
        # Build element list grouped by source code
        by_src: Dict[str, List[dict]] = defaultdict(list)
        src_display: Dict[str, str] = {}
        for m in maps:
            by_src[m["source_code"]].append(m)
            src_display[m["source_code"]] = m.get("source_display", "")
        elements = []
        for scode, items in by_src.items():
            element = {
                "code": scode,
                "display": src_display.get(scode, ""),
                "target": [],
            }
            for it in items:
                element["target"].append({
                    "code": it["target_code"],
                    "display": it.get("target_display", ""),
                    "relationship": it["mapping_type"],  # R5 uses relationship
                    "extension": [
                        {
                            "url": "http://example.org/fhir/StructureDefinition/mapping-confidence",
                            "valueDecimal": it.get("confidence", None),
                        }
                    ],
                })
            elements.append(element)
        cm["group"].append({
            "sourceScopeUri": source_url,
            "targetScopeUri": tgt_url,
            "element": elements,
        })
    out_path = OUT_DIR / f"conceptmap_{source_name.replace(' ', '_').lower()}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(cm, f, indent=2, ensure_ascii=False)
    return out_path


def write_csv(source_name: str, groups: List[Tuple[str, str, List[dict]]]) -> Path:
    import csv
    csv_path = OUT_DIR / f"conceptmap_{source_name.replace(' ', '_').lower()}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "source_system", "source_code", "target_system", "target_code",
            "mapping_type", "confidence", "source_display", "target_display",
            "src_lang", "translated_text", "backtranslation_similarity"
        ])
        for tgt_title, tgt_url, maps in groups:
            for m in maps:
                w.writerow([
                    source_name, m["source_code"], tgt_title, m["target_code"], m["mapping_type"], m.get("confidence", ""),
                    m.get("source_display", ""), m.get("target_display", ""), m.get("src_lang", ""), m.get("translated_text", ""), m.get("backtranslation_similarity", "")
                ])
    return csv_path


def write_review_csv(source_name: str, rows: List[dict]) -> Path:
    """Write a curator review CSV for uncertain candidates (0.50–0.85)."""
    import csv
    path = OUT_DIR / f"_review_{source_name.replace(' ', '_').lower()}.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "source_code", "source_display", "translated_text", "back_sim",
            "cand1_code", "cand1_label", "cand1_score",
            "cand2_code", "cand2_label", "cand2_score",
            "cand3_code", "cand3_label", "cand3_score",
            "cand4_code", "cand4_label", "cand4_score",
            "cand5_code", "cand5_label", "cand5_score",
            "suggested_relationship", "final_score", "curator_id", "comment"
        ])
        for r in rows:
            cands = r.get("candidates", [])
            flat = []
            for i in range(5):
                if i < len(cands):
                    flat.extend([cands[i][0], cands[i][1], round(float(cands[i][2] or 0.0), 2)])
                else:
                    flat.extend(["", "", ""])
            w.writerow([
                r.get("source_code", ""), r.get("source_display", ""), r.get("translated_text", ""), round(float(r.get("back_sim", 0.0)), 2),
                *flat,
                r.get("suggested_relationship", ""), round(float(r.get("final_score", 0.0)), 2), "", ""
            ])
    return path


def persist_db(conn, source_url: str, groups: List[Tuple[str, str, List[dict]]]):
    # Extend ConceptMap table with translation audit columns if not present
    for ddl in (
        "ALTER TABLE ConceptMap ADD COLUMN src_lang TEXT",
        "ALTER TABLE ConceptMap ADD COLUMN translated_text TEXT",
        "ALTER TABLE ConceptMap ADD COLUMN backtranslation_similarity REAL",
        "ALTER TABLE ConceptMap ADD COLUMN source_display TEXT",
        "ALTER TABLE ConceptMap ADD COLUMN target_display TEXT",
    ):
        try:
            conn.execute(ddl)
        except Exception:
            pass
    conn.commit()

    # Build useful map url->id
    ids = {}
    cur = conn.cursor()
    cur.execute("SELECT url, id FROM CodeSystem")
    for url, id_ in cur.fetchall():
        ids[url] = id_
    src_id = ids.get(source_url)
    if not src_id:
        return
    for tgt_title, tgt_url, maps in groups:
        tgt_id = ids.get(tgt_url)
        if not tgt_id:
            continue
        for m in maps:
            try:
                cur.execute(
                    "INSERT OR IGNORE INTO ConceptMap (source_codesystem_id, source_code, target_codesystem_id, target_code, mapping_type, confidence, src_lang, translated_text, backtranslation_similarity, source_display, target_display)\n                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        src_id,
                        m["source_code"],
                        tgt_id,
                        m["target_code"],
                        m["mapping_type"],
                        float(m.get("confidence") or 0.0),
                        m.get("src_lang"),
                        m.get("translated_text"),
                        float(m.get("backtranslation_similarity") or 0.0),
                        m.get("source_display"),
                        m.get("target_display"),
                    ),
                )
            except Exception as e:
                print(f"DB insert ConceptMap failed for {m}: {e}")
    conn.commit()


def main():
    global TRANSLATE_TO_EN, BACKTRANS_MIN_SIM, ACCEPT_SCORE_THRESHOLD, DRY_RUN_TRANSLATIONS, BATCH_SIZE, BATCH_TRANSLATE
    parser = argparse.ArgumentParser(description="Generate ConceptMaps with optional IndicTrans2 translation")
    parser.add_argument("--translate", action="store_true", help="Enable Indic→English translation")
    parser.add_argument("--no-translate", action="store_true", help="Disable translation")
    parser.add_argument("--backtrans-min", type=float, default=BACKTRANS_MIN_SIM, help="Back-translation min similarity (0-100)")
    parser.add_argument("--accept-score", type=float, default=ACCEPT_SCORE_THRESHOLD, help="Acceptance threshold for best (string) score (0-100)")
    parser.add_argument("--dry-run-translations", action="store_true", help="Only write translation audits, no mapping persistence")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Batch size for translation")
    parser.add_argument("--batch-translate", action="store_true", help="Enable batch translation per CodeSystem for speed")
    parser.add_argument("--use-per-system-thresholds", action="store_true", help="Use per-system thresholds for backtranslation and accept score")
    parser.add_argument("--use-embeddings", action="store_true", help="Use semantic embeddings to shortlist candidates (requires precompute)")
    parser.add_argument("--emit-review-csv", action="store_true", help="Also write a review CSV of uncertain candidates (0.50–0.85)")
    parser.add_argument("--system", choices=list(NAMASTE_CS.keys()), help="Only process one NAMASTE system")
    parser.add_argument("--fast", action="store_true", help="Faster matching: stricter filters and fewer label comparisons")
    args = parser.parse_args()

    # Apply CLI overrides
    if args.no_translate:
        TRANSLATE_TO_EN = False
    elif args.translate:
        TRANSLATE_TO_EN = True
    BACKTRANS_MIN_SIM = float(args.backtrans_min)
    ACCEPT_SCORE_THRESHOLD = float(args.accept_score)
    DRY_RUN_TRANSLATIONS = bool(args.dry_run_translations)
    BATCH_SIZE = int(args.batch_size)
    BATCH_TRANSLATE = bool(args.batch_translate)
    USE_EMBEDDINGS = bool(args.use_embeddings)
    USE_PER_SYSTEM = bool(args.use_per_system_thresholds)
    globals()["args_emit_review_csv"] = bool(args.emit_review_csv)
    globals()["FAST_MODE"] = bool(args.fast)

    # Auto-tune batch size if GPU available
    try:
        import torch  # type: ignore
        if torch.cuda.is_available() and BATCH_TRANSLATE and (not args.batch_size or args.batch_size <= 32):
            BATCH_SIZE = 64
    except Exception:
        pass

    conn = sqlite3.connect(str(DB_PATH))
    ids = load_codesystem_ids(conn)
    if not ids:
        print("Database empty or missing CodeSystems. Run step3_store_db.py first.")
        return

    # Prepare ICD target systems (Biomed + TM2 if available)
    icd_targets: List[Tuple[str, str]] = [("ICD-11 MMS 2024-01 Biomedicine", ICD_BIOMED_URL)]
    # Try TM2
    tm2_url = None
    roots_path = ICD11_DIR / "_roots.json"
    if roots_path.exists():
        with open(roots_path, encoding="utf-8") as f:
            roots = json.load(f)
        tm2_url = roots.get("tm2_root")
    if tm2_url:
        icd_targets.insert(0, ("ICD-11 Traditional Medicine Module 2", tm2_url))

    # Version info for traceability
    versions = get_codesystem_versions(conn)

    report = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "versions": versions,
        "systems": [],
    }

    # Optionally restrict to a single system
    iter_items = [(args.system, NAMASTE_CS[args.system])] if args.system else list(NAMASTE_CS.items())

    for src_name, src_url in iter_items:
        print(f"▶️ Mapping {src_name} ...")
        mappings_per_target, unmapped = map_system(conn, src_name, src_url, icd_targets)
        groups: List[Tuple[str, str, List[dict]]] = []
        total_maps = 0
        rel_stats = defaultdict(int)
        for (t_title, t_url) in icd_targets:
            maps = mappings_per_target.get(t_url, [])
            print(f"   • {t_title}: {len(maps)} mappings")
            for m in maps:
                rel_stats[m.get("mapping_type", "")] += 1
            groups.append((t_title, t_url, maps))
            total_maps += len(maps)
        # Write outputs
        cm_path = write_fhir_conceptmap(src_name, src_url, groups)
        csv_path = write_csv(src_name, groups)
        if not DRY_RUN_TRANSLATIONS:
            persist_db(conn, src_url, groups)

        # Write unmapped list for manual review
        unmapped_path = OUT_DIR / f"_unmapped_{src_name.replace(' ', '_').lower()}.txt"
        with open(unmapped_path, "w", encoding="utf-8") as uf:
            uf.write("\n".join(unmapped))

        report["systems"].append({
            "source": src_name,
            "codes_mapped": total_maps,
            "relationship_counts": dict(rel_stats),
            "unmapped_count": len(unmapped),
            "unmapped_file": str(unmapped_path),
            "unmapped_codes": unmapped[:2000],  # cap
            "conceptmap_json": str(cm_path),
            "conceptmap_csv": str(csv_path),
        })
        print(f"✅ {src_name}: mapped={total_maps}, unmapped={len(unmapped)} | rels: {dict(rel_stats)}")

    # Save report
    with open(OUT_DIR / "_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"📝 Wrote report to {OUT_DIR / '_report.json'}")

    conn.close()


if __name__ == "__main__":
    main()