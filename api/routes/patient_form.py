# api/routes/patient_form.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from jose import jwt, JWTError

from ..db import get_conn
from ..auth import SECRET, ALGO

router = APIRouter(prefix="/patient-forms", tags=["Patient Forms"]) 


# --- Auth dependency (decode JWT created by auth.py) ---
class Identity(BaseModel):
    sub: str
    role: str = "user"


def get_identity(authorization: Optional[str] = Header(default=None)) -> Identity:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    sub = payload.get("sub")
    role = payload.get("role", "user")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return Identity(sub=sub, role=role)


def get_identity_optional(authorization: Optional[str] = Header(default=None)) -> Optional[Identity]:
    """Return Identity if a valid bearer token is present; otherwise None.
    This lets endpoints be used without auth (matches current frontend flows).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        sub = payload.get("sub")
        role = payload.get("role", "user")
        if not sub:
            return None
        return Identity(sub=sub, role=role)
    except JWTError:
        return None


def resolve_doctor_user_id(conn, ident: Identity) -> Optional[int]:
    # Only for role=doctor and email-based subjects
    if ident.role != "doctor":
        return None
    sub = ident.sub or ""
    if sub.startswith("abha:"):
        return None  # ABHA doctor login without local user record
    if "@" not in sub:
        return None
    cur = conn.cursor()
    cur.execute("SELECT id FROM User WHERE email=?", (sub,))
    row = cur.fetchone()
    return int(row[0]) if row else None


# --- Models ---
class PatientFormCreate(BaseModel):
    abha_id: Optional[str] = None
    patient_name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    contact: Optional[str] = None
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    icd_system: Optional[str] = "ICD-11"
    icd_code: Optional[str] = None
    notes: Optional[str] = None


class PatientFormUpdate(BaseModel):
    abha_id: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    contact: Optional[str] = None
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    icd_system: Optional[str] = None
    icd_code: Optional[str] = None
    notes: Optional[str] = None


class PatientFormOut(BaseModel):
    id: int
    doctor_user_id: Optional[int] = None
    doctor_abha_id: Optional[str] = None
    abha_id: Optional[str] = None
    patient_name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    contact: Optional[str] = None
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    icd_system: Optional[str] = None
    icd_code: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# --- Helpers ---

def row_to_out(row) -> PatientFormOut:
    return PatientFormOut(
        id=row["id"],
        doctor_user_id=row["doctor_user_id"],
        doctor_abha_id=row["doctor_abha_id"] if "doctor_abha_id" in row.keys() else None,
        abha_id=row["abha_id"],
        patient_name=row["patient_name"],
        age=row["age"],
        sex=row["sex"],
        contact=row["contact"],
        symptoms=row["symptoms"],
        diagnosis=row["diagnosis"],
        icd_system=row["icd_system"],
        icd_code=row["icd_code"],
        notes=row["notes"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# --- Routes ---
@router.post("/", response_model=PatientFormOut)
def create_form(body: PatientFormCreate, ident: Identity = Depends(get_identity)):
    if ident.role != "doctor":
        raise HTTPException(403, "Only doctors can create patient forms")
    conn = get_conn()
    try:
        doc_id = resolve_doctor_user_id(conn, ident)
        doctor_abha_id: Optional[str] = None
        if ident.sub.startswith("abha:"):
            doctor_abha_id = ident.sub.split(":", 1)[1]
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO PatientForm(
              doctor_user_id, doctor_abha_id, abha_id, patient_name, age, sex, contact,
              symptoms, diagnosis, icd_system, icd_code, notes
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                doc_id,
                doctor_abha_id,
                body.abha_id,
                body.patient_name,
                body.age,
                body.sex,
                body.contact,
                body.symptoms,
                body.diagnosis,
                body.icd_system,
                body.icd_code,
                body.notes,
            ),
        )
        conn.commit()
        new_id = cur.lastrowid
        cur.execute("SELECT * FROM PatientForm WHERE id=?", (new_id,))
        row = cur.fetchone()
        return row_to_out(row)
    finally:
        conn.close()


@router.get("/", response_model=List[PatientFormOut])
def list_forms(
    ident: Identity = Depends(get_identity),
    mine_only: bool = Query(True, description="If true, only forms by the current doctor are returned"),
    abha_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        where: List[str] = []
        params: List[Any] = []
        doc_id = resolve_doctor_user_id(conn, ident)
        if mine_only:
            # Prefer local user ownership; else fall back to ABHA-based ownership
            if doc_id is not None:
                where.append("doctor_user_id = ?")
                params.append(doc_id)
            else:
                sub = ident.sub or ""
                if sub.startswith("abha:"):
                    where.append("doctor_abha_id = ?")
                    params.append(sub.split(":", 1)[1])
                else:
                    return []  # Cannot determine doctor ownership; avoid leaking data
        if abha_id:
            where.append("abha_id = ?")
            params.append(abha_id)
        clause = (" WHERE " + " AND ".join(where)) if where else ""
        sql = f"SELECT * FROM PatientForm{clause} ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        return [row_to_out(r) for r in rows]
    finally:
        conn.close()


@router.get("/{form_id}", response_model=PatientFormOut)
def get_form(form_id: int, ident: Identity = Depends(get_identity)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM PatientForm WHERE id=?", (form_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Form not found")
        return row_to_out(row)
    finally:
        conn.close()


@router.put("/{form_id}", response_model=PatientFormOut)
@router.patch("/{form_id}", response_model=PatientFormOut)
def update_form(form_id: int, body: PatientFormUpdate, ident: Identity = Depends(get_identity)):
    if ident.role != "doctor":
        raise HTTPException(403, "Only doctors can update patient forms")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM PatientForm WHERE id=?", (form_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Form not found")
        owner_id = row["doctor_user_id"]
        my_id = resolve_doctor_user_id(conn, ident)
        if owner_id is not None and my_id is not None and owner_id != my_id:
            raise HTTPException(403, "You do not own this form")
        # Build dynamic SET
        updates: List[str] = []
        params: List[Any] = []
        for col, val in (
            ("abha_id", body.abha_id),
            ("patient_name", body.patient_name),
            ("age", body.age),
            ("sex", body.sex),
            ("contact", body.contact),
            ("symptoms", body.symptoms),
            ("diagnosis", body.diagnosis),
            ("icd_system", body.icd_system),
            ("icd_code", body.icd_code),
            ("notes", body.notes),
        ):
            if val is not None:
                updates.append(f"{col}=?")
                params.append(val)
        if not updates:
            return row_to_out(row)
        sql = f"UPDATE PatientForm SET {', '.join(updates)} WHERE id=?"
        params.append(form_id)
        cur.execute(sql, tuple(params))
        conn.commit()
        cur.execute("SELECT * FROM PatientForm WHERE id=?", (form_id,))
        return row_to_out(cur.fetchone())
    finally:
        conn.close()


@router.delete("/{form_id}")
def delete_form(form_id: int, ident: Identity = Depends(get_identity)):
    if ident.role != "doctor":
        raise HTTPException(403, "Only doctors can delete patient forms")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT doctor_user_id FROM PatientForm WHERE id=?", (form_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Form not found")
        owner_id = row["doctor_user_id"]
        my_id = resolve_doctor_user_id(conn, ident)
        if owner_id is not None and my_id is not None and owner_id != my_id:
            raise HTTPException(403, "You do not own this form")
        cur.execute("DELETE FROM PatientForm WHERE id=?", (form_id,))
        conn.commit()
        return {"status": "deleted", "id": form_id}
    finally:
        conn.close() 