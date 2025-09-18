# api/routes/reports.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from pathlib import Path
from datetime import datetime
import re

router = APIRouter(prefix="/reports", tags=["Reports"])

REPORTS_DIR = Path("db/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class MappingItem(BaseModel):
    source_system: str
    source_code: str
    icd_tm2_code: Optional[str] = None
    icd_bio_code: Optional[str] = None
    notes: Optional[str] = None


class ReportRequest(BaseModel):
    patient_id: str
    patient_name: str
    age: Optional[str] = None
    gender: Optional[str] = None
    conditions: List[MappingItem]
    doctor_name: Optional[str] = None
    followup_date: Optional[str] = None


def _safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "", s or "")[:64]


@router.post("/export")
def export_report(req: ReportRequest):
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 50

    def line(txt, size=12, dy=18):
        nonlocal y
        c.setFont("Helvetica", size)
        c.drawString(40, y, txt)
        y -= dy

    # Header
    line("AYUSetu Report", 18, 26)
    c.line(40, y + 10, w - 40, y + 10)
    y -= 10

    # Patient
    line(f"Patient: {req.patient_name}  (ID: {req.patient_id})", 12)
    if req.age or req.gender:
        line(f"Age: {req.age or '-'}   Gender: {req.gender or '-'}")
    if req.doctor_name:
        line(f"Doctor: {req.doctor_name}")
    if req.followup_date:
        line(f"Follow-up: {req.followup_date}")
    y -= 10

    # Conditions
    line("Conditions & Mappings:", 14, 22)
    for i, m in enumerate(req.conditions, 1):
        if y < 100:
            c.showPage()
            y = h - 50
        line(f"{i}. {m.source_system} {m.source_code}", 12)
        if m.icd_tm2_code:
            line(f"    ICD-11 TM2: {m.icd_tm2_code}", 11)
        if m.icd_bio_code:
            line(f"    ICD-11 Biomedicine: {m.icd_bio_code}", 11)
        if m.notes:
            line(f"    Notes: {m.notes}", 10)
        y -= 6

    c.showPage()
    c.save()
    buf.seek(0)

    # Persist a copy for patient history
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    fname = f"{ts}_{_safe_name(req.patient_id)}.pdf"
    out_path = REPORTS_DIR / fname
    try:
        out_path.write_bytes(buf.getvalue())
    except Exception:
        # Non-fatal; still stream response
        pass

    return StreamingResponse(
        BytesIO(buf.getvalue()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ayusetu-report.pdf"'},
    )


@router.get("/history")
def history(patient_id: str):
    safe = _safe_name(patient_id)
    items = []
    for p in sorted(REPORTS_DIR.glob(f"*_{safe}.pdf"), reverse=True):
        try:
            ts_str = p.name.split("_", 1)[0]
            created_at = datetime.strptime(ts_str, "%Y%m%d%H%M%S").isoformat()
        except Exception:
            created_at = None
        items.append({
            "filename": p.name,
            "created_at": created_at,
            "url": f"/reports/download/{p.name}",
        })
    return {"items": items}


@router.get("/download/{filename}")
def download(filename: str):
    if "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    path = REPORTS_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Report not found")
    return StreamingResponse(open(path, "rb"), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})