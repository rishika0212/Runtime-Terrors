# api/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.codesystems import router as codesystems_router
from .routes.search import router as search_router
from .routes.translate import router as translate_router
from .routes.suggest import router as suggest_router
from .routes.patient_form import router as patient_form_router
from .auth import router as auth_router
from .routes.reports import router as reports_router
from .routes.graph import router as graph_router
from .routes.mappings import mappings_router
from .routes.fhir import router as fhir_router
from .migrations import run as run_migrations


app = FastAPI(title="Terminology API", version="0.4.0")

# Run lightweight migrations at startup (idempotent)
try:
    run_migrations()
except Exception:
    # Avoid blocking startup; db access will still raise clear errors if missing
    pass

# CORS (adjust allow_origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# Mount routers
app.include_router(codesystems_router)
app.include_router(search_router)
app.include_router(translate_router)
app.include_router(suggest_router)
app.include_router(patient_form_router)
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(graph_router)
app.include_router(mappings_router, tags=["mappings"])
app.include_router(fhir_router)
