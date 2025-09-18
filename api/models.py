# api/models.py
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class CodeSystemOut(BaseModel):
    url: str
    name: Optional[str] = None
    title: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None


class ConceptOut(BaseModel):
    system: str
    code: str
    display: str = ""
    definition: str = ""


class SearchResult(BaseModel):
    system: str
    code: str
    display: str = ""
    definition: str = ""
    score: float = 1.0


class TranslateRequest(BaseModel):
    system: str
    code: str


class Translation(BaseModel):
    source_system: str
    source_code: str
    target_system: str
    target_code: str
    mapping_type: str
    confidence: Optional[float] = None


class TranslateResponse(BaseModel):
    translations: List[Translation]


# Pagination envelopes
class PaginatedConcepts(BaseModel):
    items: List[ConceptOut]
    total: int
    limit: int
    offset: int
    next_offset: Optional[int] = None


class PaginatedSearch(BaseModel):
    items: List[SearchResult]
    total: int
    limit: int
    offset: int
    next_offset: Optional[int] = None


# Suggestion models (semantic candidate mappings)
class SuggestRequest(BaseModel):
    system: str
    code: Optional[str] = None
    text: Optional[str] = None
    target_systems: Optional[List[str]] = None
    limit: int = 10


class SuggestItem(BaseModel):
    source_system: str
    source_code: Optional[str] = None
    query_text: str
    candidate_system: str
    candidate_code: str
    display: str = ""
    score: float


class SuggestResponse(BaseModel):
    items: List[SuggestItem]


# ConceptMap listing models
class ConceptMapItem(BaseModel):
    source_system: str
    source_code: str
    target_system: str
    target_code: str
    mapping_type: str
    confidence: Optional[float] = None
    source_display: Optional[str] = None
    target_display: Optional[str] = None


class PaginatedConceptMaps(BaseModel):
    items: List[ConceptMapItem]
    total: int
    limit: int
    offset: int
    next_offset: Optional[int] = None