# api/main.py
from __future__ import annotations

from fastapi import FastAPI

from .routes.codesystems import router as codesystems_router
from .routes.search import router as search_router
from .routes.translate import router as translate_router
from .routes.suggest import router as suggest_router

app = FastAPI(title="Terminology API", version="0.2.0")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# Mount routers
app.include_router(codesystems_router)
app.include_router(search_router)
app.include_router(translate_router)
app.include_router(suggest_router)

# Run with: uvicorn api.main:app --host 0.0.0.0 --port 8000