# api/routes/fhir.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from ..db import get_conn
from ..cache import cache

router = APIRouter(prefix="/fhir", tags=["FHIR"])

# --- Helpers ---

def _codesystem_to_fhir(row) -> Dict[str, Any]:
    return {
        "resourceType": "CodeSystem",
        "meta": {"versionId": str(row["version"] or "1")},
        "url": row["url"],
        "name": row["name"],
        "title": row["title"],
        "status": row["status"] or "active",
        "version": row["version"],
        # Note: concepts fetched via separate call to keep payloads light
    }


def _concept_to_coding(system_url: str, code: str, display: str) -> Dict[str, Any]:
    return {"system": system_url, "code": code, "display": display or ""}


# --- FHIR CodeSystem ---
@router.get("/CodeSystem")
def get_codesystem_by_url(url: str = Query(..., description="Canonical URL of the CodeSystem")):
    cache_key = ("fhir_codesystem", url)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT url, name, title, version, status FROM CodeSystem WHERE url=?", (url,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "CodeSystem not found")
        res = _codesystem_to_fhir(row)
        cache.set(cache_key, res, 60)
        return res
    finally:
        conn.close()


# --- FHIR CodeSystem $lookup (minimal) ---
@router.get("/CodeSystem/$lookup")
def codesystem_lookup(
    system: str = Query(..., description="CodeSystem URL|name|title"),
    code: str = Query(..., description="Code to look up"),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, url FROM CodeSystem WHERE url=? OR name=? OR title=?", (system, system, system))
        cs = cur.fetchone()
        if not cs:
            raise HTTPException(404, "CodeSystem not found")
        cs_id, url = int(cs[0]), cs[1]
        cur.execute(
            "SELECT COALESCE(display,''), COALESCE(definition,'') FROM Concept WHERE codesystem_id=? AND code=?",
            (cs_id, code),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Code not found")
        return {
            "resourceType": "Parameters",
            "parameter": [
                {"name": "name", "valueString": url},
                {"name": "version", "valueString": ""},
                {"name": "display", "valueString": row[0] or ""},
                {"name": "definition", "valueString": row[1] or ""},
            ],
        }
    finally:
        conn.close()


# --- FHIR CodeSystem $validate-code (minimal) ---
@router.get("/CodeSystem/$validate-code")
def codesystem_validate_code(
    system: str = Query(..., description="CodeSystem URL|name|title"),
    code: str = Query(..., description="Code to validate"),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM CodeSystem WHERE url=? OR name=? OR title=?", (system, system, system))
        cs = cur.fetchone()
        if not cs:
            return {"resourceType": "Parameters", "parameter": [{"name": "result", "valueBoolean": False}]}
        cs_id = int(cs[0])
        cur.execute("SELECT 1 FROM Concept WHERE codesystem_id=? AND code=?", (cs_id, code))
        ok = cur.fetchone() is not None
        return {"resourceType": "Parameters", "parameter": [{"name": "result", "valueBoolean": ok}]}
    finally:
        conn.close()


# --- FHIR ValueSet $expand (autocomplete) ---
@router.get("/ValueSet/$expand")
def valueset_expand(
    url: str = Query(..., description="ValueSet URL (we use its system binding)"),
    filter: Optional[str] = Query(None, description="Text filter for display or code"),
    count: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Minimal $expand: this implementation expects ValueSet URL to correspond to a single CodeSystem
    known in the DB. For prototypes, we map a few well-known URLs to systems.
    """
    # Map common ValueSet URLs to local system URLs
    vs_map = {
        "http://example.org/fhir/ValueSet/NAMASTE-AYURVEDA": "NAMASTE_AYURVEDA",
        "http://example.org/fhir/ValueSet/NAMASTE-SIDDHA": "NAMASTE_SIDDHA",
        "http://example.org/fhir/ValueSet/NAMASTE-UNANI": "NAMASTE_UNANI",
        "http://example.org/fhir/ValueSet/ICD11_TM2": "ICD11_TM2",
        "http://example.org/fhir/ValueSet/ICD11_MMS": "ICD11_MMS",
    }
    system = vs_map.get(url)
    if not system:
        # try: direct pass-through if caller already passes system URL/name/title
        system = url

    conn = get_conn()
    try:
        cur = conn.cursor()
        # Resolve system to codesystem_id
        cur.execute("SELECT id, url FROM CodeSystem WHERE url=? OR name=? OR title=?", (system, system, system))
        cs = cur.fetchone()
        if not cs:
            raise HTTPException(404, "ValueSet system not found")
        cs_id, system_url = int(cs[0]), cs[1]

        where = "codesystem_id=?"
        params: List[Any] = [cs_id]
        if filter:
            like = f"%{filter}%"
            where += " AND (code LIKE ? OR display LIKE ? OR NORM(code) LIKE NORM(?) OR NORM(display) LIKE NORM(?))"
            params.extend([like, like, filter, filter])

        # total
        cur.execute(f"SELECT COUNT(1) FROM Concept WHERE {where}", tuple(params))
        total = int(cur.fetchone()[0])

        # page
        cur.execute(
            f"""
            SELECT code, COALESCE(display,'') AS display
            FROM Concept
            WHERE {where}
            ORDER BY code
            LIMIT ? OFFSET ?
            """,
            tuple(params + [count, offset]),
        )
        items = [{"code": r["code"], "display": r["display"]} for r in cur.fetchall()]
        exp = {
            "resourceType": "ValueSet",
            "url": url,
            "expansion": {
                "total": total,
                "offset": offset,
                "parameter": [{"name": "count", "valueInteger": count}],
                "contains": [
                    {"system": system_url, "code": it["code"], "display": it["display"]}
                    for it in items
                ],
            },
        }
        return exp
    finally:
        conn.close()


# --- FHIR ConceptMap $translate ---
@router.post("/ConceptMap/$translate")
def conceptmap_translate(params: Dict[str, Any]):
    """
    Accepts FHIR Parameters with fields: system, code, (optional) targetsystem
    Returns FHIR Parameters with match results.
    """
    # extract from Parameters
    def _param(name: str) -> Optional[str]:
        for p in params.get("parameter", []):
            if p.get("name") == name:
                return p.get("valueUri") or p.get("valueCode") or p.get("valueString")
        return None

    system = _param("system")
    code = _param("code")
    targetsystem = _param("targetsystem")
    if not system or not code:
        raise HTTPException(400, "Parameters 'system' and 'code' required")

    cache_key = ("fhir_translate", system, code, targetsystem)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    conn = get_conn()
    try:
        cur = conn.cursor()
        # resolve source codesystem id
        cur.execute("SELECT id FROM CodeSystem WHERE url=? OR name=? OR title=?", (system, system, system))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Source CodeSystem not found")
        src_id = int(row[0])

        where_tgt = ""
        params_sql: List[Any] = [src_id, code]
        if targetsystem:
            cur.execute("SELECT id FROM CodeSystem WHERE url=? OR name=? OR title=?", (targetsystem, targetsystem, targetsystem))
            tgt_row = cur.fetchone()
            if tgt_row:
                where_tgt = " AND cm.target_codesystem_id = ?"
                params_sql.append(int(tgt_row[0]))

        # forward
        cur.execute(
            f"""
            SELECT s.url AS source_system, cm.source_code, t.url AS target_system, cm.target_code, cm.mapping_type, cm.confidence
            FROM ConceptMap cm
            JOIN CodeSystem s ON s.id = cm.source_codesystem_id
            JOIN CodeSystem t ON t.id = cm.target_codesystem_id
            WHERE cm.source_codesystem_id=? AND cm.source_code=? {where_tgt}
            """,
            tuple(params_sql),
        )
        rows = cur.fetchall()

        # FHIR Parameters response
        out = {
            "resourceType": "Parameters",
            "parameter": [
                {
                    "name": "match",
                    "part": [
                        {"name": "equivalence", "valueCode": (r["mapping_type"] or "related-to").lower()},
                        {
                            "name": "concept",
                            "valueCoding": {
                                "system": r["target_system"],
                                "code": r["target_code"],
                            },
                        },
                    ],
                }
                for r in rows
            ],
        }
        cache.set(cache_key, out, 60)
        return out
    finally:
        conn.close()


# --- FHIR Provenance & AuditEvent (create) ---
@router.post("/Provenance")
def create_provenance(resource: Dict[str, Any]):
    if resource.get("resourceType") != "Provenance":
        raise HTTPException(400, "resourceType must be Provenance")
    import json as _json
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO FhirProvenance(raw) VALUES(?)", (_json.dumps(resource, ensure_ascii=False),))
        conn.commit()
        return {"resourceType": "OperationOutcome", "issue": [{"severity": "information", "code": "informational", "details": {"text": "Provenance stored"}}]}
    finally:
        conn.close()


@router.post("/AuditEvent")
def create_auditevent(resource: Dict[str, Any]):
    if resource.get("resourceType") != "AuditEvent":
        raise HTTPException(400, "resourceType must be AuditEvent")
    import json as _json
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO FhirAuditEvent(raw) VALUES(?)", (_json.dumps(resource, ensure_ascii=False),))
        conn.commit()
        return {"resourceType": "OperationOutcome", "issue": [{"severity": "information", "code": "informational", "details": {"text": "AuditEvent stored"}}]}
    finally:
        conn.close()


# --- FHIR Bundle ingest (minimal Problem List/Condition) ---
@router.post("/Bundle")
def ingest_bundle(bundle: Dict[str, Any]):
    if bundle.get("resourceType") != "Bundle":
        raise HTTPException(400, "resourceType must be Bundle")
    entries = bundle.get("entry", []) or []

    conn = get_conn()
    try:
        cur = conn.cursor()
        # store raw bundle
        import json
        raw = json.dumps(bundle, ensure_ascii=False)
        cur.execute("INSERT INTO FhirBundle(raw) VALUES(?)", (raw,))
        bundle_id = cur.lastrowid
        # bump FhirBundle version explicitly (helps when we update later)
        cur.execute("UPDATE FhirBundle SET version = COALESCE(version,1) WHERE id=?", (bundle_id,))

        def pick_code(codings: List[Dict[str, Any]], preferred: List[str]) -> Optional[Dict[str, str]]:
            for pref in preferred:
                for c in codings:
                    if (c.get("system") or "").lower() == pref.lower():
                        return {"system": c.get("system"), "code": c.get("code")}
            return None

        # parse conditions
        for e in entries:
            res = e.get("resource") or {}
            if res.get("resourceType") != "Condition":
                continue
            patient_ref = (res.get("subject") or {}).get("reference")
            codings = ((res.get("code") or {}).get("coding") or [])
            disp = (res.get("code") or {}).get("text")
            asserter = res.get("asserter") or {}
            asserter_ref = asserter.get("reference")
            asserter_disp = asserter.get("display")
            # choose codes: accept canonical URLs, internal names, and human-readable labels from CSVs
            nm = None
            tm2 = None
            mms = None
            for c in codings:
                sys = (c.get("system") or "").lower()
                code = c.get("code")
                if not code:
                    continue
                # NAMASTE systems (any of the traditions)
                if ("namaste" in sys) or sys in {
                    "namaste_ayurveda",
                    "namaste_siddha",
                    "namaste_unani",
                }:
                    nm = {"system": c.get("system"), "code": code}
                # ICD-11 TM2 (traditional medicine module)
                if ("/11/26" in sys) or ("traditional medicine module" in sys) or (c.get("system") == "ICD11_TM2"):
                    tm2 = {"system": c.get("system"), "code": code}
                # ICD-11 MMS (biomedicine)
                if ("/11/mms" in sys) or ("mms" in sys) or ("biomedicine" in sys) or (c.get("system") == "ICD11_MMS"):
                    mms = {"system": c.get("system"), "code": code}

            cur.execute(
                """
                INSERT INTO FhirCondition(
                    bundle_id, patient_reference, display,
                    namaste_system, namaste_code,
                    icd11_tm2_system, icd11_tm2_code,
                    icd11_mms_system, icd11_mms_code,
                    asserter_reference, asserter_display
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    bundle_id,
                    patient_ref,
                    disp,
                    (nm or {}).get("system"), (nm or {}).get("code"),
                    (tm2 or {}).get("system"), (tm2 or {}).get("code"),
                    (mms or {}).get("system"), (mms or {}).get("code"),
                    asserter_ref, asserter_disp,
                ),
            )

        conn.commit()

        # Auto-log a lightweight AuditEvent for ingest
        try:
            ae = {
                "resourceType": "AuditEvent",
                "type": {"system": "http://terminology.hl7.org/CodeSystem/audit-event-type", "code": "rest"},
                "action": "C",
                "outcome": "0",
                "recorded": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "agent": [{"requestor": False}],
                "source": {"observer": {"display": "AYUSetu Terminology API"}},
                "entity": [{"what": {"reference": f"Bundle/{bundle_id}"}}],
            }
            import json as _json
            cur.execute("INSERT INTO FhirAuditEvent(raw) VALUES(?)", (_json.dumps(ae, ensure_ascii=False),))
            conn.commit()
        except Exception:
            pass

        # minimal success response (Bundle-like)
        return {
            "resourceType": "Bundle",
            "type": "transaction-response",
            "entry": [
                {"response": {"status": "201 Created"}}
                for _ in entries
            ],
        }
    finally:
        conn.close()


# --- FHIR Condition search (by patient) ---
@router.get("/Condition")
def search_condition(
    patient: str = Query(..., description="Patient reference, e.g., 'Patient/123'"),
    count: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return minimal FHIR Condition resources stored via Bundle ingest for a given patient."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        # total
        cur.execute(
            "SELECT COUNT(1) FROM FhirCondition WHERE patient_reference=?",
            (patient,),
        )
        total = int(cur.fetchone()[0])

        # page
        cur.execute(
            """
            SELECT id, patient_reference, COALESCE(display,'') AS display,
                   namaste_system, namaste_code,
                   icd11_tm2_system, icd11_tm2_code,
                   icd11_mms_system, icd11_mms_code,
                   asserter_reference, asserter_display,
                   COALESCE(version,1) AS version, last_updated
            FROM FhirCondition
            WHERE patient_reference=?
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (patient, count, offset),
        )
        rows = cur.fetchall()

        def maybe_coding(system: Optional[str], code: Optional[str]) -> Optional[Dict[str, str]]:
            if system and code:
                return {"system": system, "code": code}
            return None

        entries: List[Dict[str, Any]] = []
        for r in rows:
            codings = list(
                filter(
                    None,
                    [
                        maybe_coding(r["namaste_system"], r["namaste_code"]),
                        maybe_coding(r["icd11_tm2_system"], r["icd11_tm2_code"]),
                        maybe_coding(r["icd11_mms_system"], r["icd11_mms_code"]),
                    ],
                )
            )
            asserter = {}
            if r["asserter_reference"] or r["asserter_display"]:
                asserter = {"reference": r["asserter_reference"], "display": r["asserter_display"]}
            condition = {
                "resourceType": "Condition",
                "id": str(r["id"]),
                "meta": {
                    "versionId": str(r["version"] or 1),
                    "lastUpdated": ((r["last_updated"] or "").replace(" ", "T") + "Z") if r["last_updated"] else None,
                },
                "subject": {"reference": r["patient_reference"]},
                "code": {
                    "text": r["display"] or "",
                    "coding": codings,
                },
                "asserter": asserter if asserter else None,
            }
            entries.append({"resource": condition})

        # Remove mock fallback: only return real data

        bundle = {
            "resourceType": "Bundle",
            "type": "searchset",
            "total": total,
            "link": [
                {
                    "relation": "self",
                    "url": f"/fhir/Condition?patient={patient}&count={count}&offset={offset}",
                }
            ],
            "entry": entries,
        }
        return bundle
    finally:
        conn.close()