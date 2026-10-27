"""Read-only registry endpoints for the roadmap's data sources and official documents."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..data.models import DataSource, IngestionRun
from ..data.schemas import (
    DataSourceDetail,
    DataSourceList,
    DataSourceRead,
    IngestionRunRead,
    Priority,
    ScopeRead,
    TestStatus,
)
from ..state_scope import scope_payload
from .projects import get_session

router = APIRouter(prefix="/data-sources", tags=["Data sources"])

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
OFFICIAL_DOCS_DIR = DATA_DIR / "official_documents"
MANIFEST_PATH = DATA_DIR / "documents_manifest.json"
REGULATORY_PACKS_PATH = DATA_DIR / "state_regulatory_packs.json"
ENVIRONMENTAL_DATASETS_PATH = DATA_DIR / "environmental_datasets.json"


def _load_json_file(path: Path) -> dict:
    if not path.is_file():
        raise HTTPException(
            503,
            detail={"code": "dataset_unavailable", "message": f"Data file {path.name} is missing from the repository."},
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(
            500,
            detail={"code": "dataset_parse_error", "message": f"Failed to parse {path.name}: {exc}"},
        ) from exc


@router.get("", response_model=DataSourceList)
def list_data_sources(
    priority: Priority | None = Query(default=None),
    test_status: TestStatus | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """List every registered source with its maturity gate and runtime state.

    Filtering never hides the registry totals: ``by_priority`` and ``by_test_status``
    always describe the full registry so the dashboard cannot imply broader coverage
    than exists.
    """
    sources = session.scalars(select(DataSource).order_by(DataSource.priority, DataSource.id)).all()
    by_priority = Counter(source.priority for source in sources)
    by_test_status = Counter(source.test_status for source in sources)
    items = [
        source
        for source in sources
        if (priority is None or source.priority == priority)
        and (test_status is None or source.test_status == test_status)
    ]
    return {
        "items": items,
        "total": len(items),
        "by_priority": dict(sorted(by_priority.items())),
        "by_test_status": dict(sorted(by_test_status.items())),
        "scope": scope_payload(),
    }


@router.get("/scope", response_model=ScopeRead)
def read_scope():
    """Return the four-state geographic scope applied to candidate sites."""
    return scope_payload()


@router.get("/documents")
def list_official_documents(
    state: str | None = Query(default=None),
    instrument_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    """Return catalog of authentic official government documents and policies."""
    manifest = _load_json_file(MANIFEST_PATH)
    docs = manifest.get("documents", [])
    
    filtered = []
    for doc in docs:
        if state and doc.get("state", "").lower() != state.lower() and state.lower() not in doc.get("jurisdiction", "").lower():
            continue
        if instrument_type and instrument_type.lower() not in doc.get("instrument_type", "").lower():
            continue
        if q:
            term = q.lower()
            haystack = f"{doc.get('title', '')} {doc.get('description', '')} {doc.get('issuing_authority', '')} {doc.get('state', '')}".lower()
            if term not in haystack:
                continue
        
        # Verify local file presence
        filename = doc.get("filename", "")
        file_path = OFFICIAL_DOCS_DIR / filename
        doc_entry = dict(doc)
        doc_entry["file_available"] = file_path.is_file()
        doc_entry["download_url"] = f"/api/v1/data-sources/documents/{doc['id']}/download"
        filtered.append(doc_entry)
        
    return {
        "total": len(filtered),
        "focus_states": manifest.get("focus_states", []),
        "national_framework": manifest.get("national_framework"),
        "documents": filtered,
    }


@router.get("/documents/{doc_id}")
def get_official_document(doc_id: str):
    """Return detailed metadata and extracted provisions for an official document."""
    manifest = _load_json_file(MANIFEST_PATH)
    docs = manifest.get("documents", [])
    for doc in docs:
        if doc.get("id") == doc_id:
            filename = doc.get("filename", "")
            file_path = OFFICIAL_DOCS_DIR / filename
            doc_entry = dict(doc)
            doc_entry["file_available"] = file_path.is_file()
            doc_entry["download_url"] = f"/api/v1/data-sources/documents/{doc_id}/download"
            return doc_entry
            
    raise HTTPException(
        404,
        detail={"code": "document_not_found", "message": f"Official document '{doc_id}' is not in the manifest."},
    )


@router.get("/documents/{doc_id}/download")
def download_official_document(doc_id: str):
    """Download the actual official PDF or XLSX document."""
    manifest = _load_json_file(MANIFEST_PATH)
    docs = manifest.get("documents", [])
    target = None
    for doc in docs:
        if doc.get("id") == doc_id:
            target = doc
            break
            
    if not target:
        raise HTTPException(
            404,
            detail={"code": "document_not_found", "message": f"Official document '{doc_id}' is not in the manifest."},
        )
        
    filename = target.get("filename", "")
    file_path = OFFICIAL_DOCS_DIR / filename
    if not file_path.is_file():
        raise HTTPException(
            404,
            detail={"code": "file_not_found_on_disk", "message": f"Document file '{filename}' is not stored on disk."},
        )
        
    media_type = "application/pdf"
    if filename.endswith(".xlsx"):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )


@router.get("/state-packs")
def list_state_packs():
    """Return regulatory and policy packs for the four focus states (TG, MH, KA, TN)."""
    return _load_json_file(REGULATORY_PACKS_PATH)


@router.get("/state-packs/{state_key}")
def get_state_pack(state_key: str):
    """Return regulatory intelligence for a specific focus state."""
    packs = _load_json_file(REGULATORY_PACKS_PATH).get("packs", {})
    key = state_key.lower().replace("-", "_")
    if key in packs:
        return packs[key]
    raise HTTPException(
        404,
        detail={
            "code": "state_pack_not_found",
            "message": f"State pack '{state_key}' not found. Available focus states: {list(packs.keys())}",
        },
    )


@router.get("/environmental")
def get_environmental_datasets():
    """Return the bundled environmental reference payload for the four focus states.

    Each section carries its own provenance. Only the CEA national grid factors are
    verified against a bundled source; the other sections are unverified reference
    values and none of them is used in a score.
    """
    return _load_json_file(ENVIRONMENTAL_DATASETS_PATH)


@router.get("/{source_id}", response_model=DataSourceDetail)
def read_data_source(source_id: str, session: Session = Depends(get_session)):
    source = session.get(DataSource, source_id)
    if source is None:
        raise HTTPException(
            404,
            detail={"code": "data_source_not_found", "message": "Data source is not registered."},
        )
    runs = session.scalars(
        select(IngestionRun)
        .where(IngestionRun.source_id == source_id)
        .order_by(IngestionRun.started_at.desc())
        .limit(10)
    ).all()
    detail = DataSourceDetail.model_validate(source)
    detail.recent_runs = [IngestionRunRead.model_validate(run) for run in runs]
    return detail
