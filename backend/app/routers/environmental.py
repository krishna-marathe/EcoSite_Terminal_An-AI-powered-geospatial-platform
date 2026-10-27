"""Local-only environmental analysis for candidate polygons.

This endpoint is the bridge between the roadmap's P0 connectors and the dashboard.
It runs only implemented connectors, stores every observation with provenance, and
returns an explicit failure per source instead of inventing a value.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..data.connectors import CONNECTORS
from ..data.connectors.base import FetchRequest
from ..data.ingest import run_ingestion
from ..data.models import Observation
from ..data.schemas import (
    EnvironmentalAnalysisRequest,
    EnvironmentalAnalysisResponse,
    IngestionResultRead,
    ObservationList,
    ObservationRead,
)
from ..models.sites import CandidateSite
from ..state_scope import FOCUS_STATES
from .projects import get_session, local_only

router = APIRouter(prefix="/sites", tags=["Environmental observations"], dependencies=[Depends(local_only)])


def _site_or_404(session: Session, site_id: UUID) -> CandidateSite:
    site = session.get(CandidateSite, str(site_id))
    if site is None:
        raise HTTPException(404, detail={"code": "site_not_found", "message": "Candidate site not found."})
    return site


def _site_observations(session: Session, site_id: str, source_id: str | None = None) -> list[Observation]:
    statement = select(Observation).where(Observation.site_id == site_id)
    if source_id is not None:
        statement = statement.where(Observation.source_id == source_id)
    return list(session.scalars(statement.order_by(Observation.source_id, Observation.indicator)).all())


@router.post("/{site_id}/environmental-analysis", response_model=EnvironmentalAnalysisResponse)
def environmental_analysis(
    site_id: UUID,
    body: EnvironmentalAnalysisRequest,
    session: Session = Depends(get_session),
):
    """Fetch the requested P0 sources for one candidate polygon.

    Each source is fetched and parsed independently. A failed source is recorded as
    a failed ingestion run and does not erase observations from a source that worked.
    """
    site = _site_or_404(session, site_id)
    if site.status != "active":
        raise HTTPException(409, detail={"code": "site_archived", "message": "Restore the candidate before analysing it."})
    if site.state_code not in FOCUS_STATES:
        raise HTTPException(
            409,
            detail={
                "code": "state_out_of_scope",
                "message": "This candidate is outside the four-state scope. Recreate it in Telangana, Maharashtra, Karnataka or Tamil Nadu.",
            },
        )
    if not body.sources:
        raise HTTPException(422, detail={"code": "no_sources", "message": "Select at least one implemented source."})
    unsupported = sorted(set(body.sources) - set(CONNECTORS))
    if unsupported:
        raise HTTPException(
            422,
            detail={
                "code": "source_not_implemented",
                "message": f"Connectors are not implemented for: {', '.join(unsupported)}.",
            },
        )

    request = FetchRequest(
        geometry=site.geometry,
        geometry_hash=site.geometry_hash,
        site_id=site.id,
        buffer_m=body.buffer_m,
        max_tiles=body.max_tiles,
        max_pages=body.max_pages,
    )
    results = [
        run_ingestion(session, source_id, request, connector=CONNECTORS[source_id])
        for source_id in dict.fromkeys(body.sources)
    ]
    observations = _site_observations(session, site.id)
    payload = EnvironmentalAnalysisResponse(
        site_id=site.id,
        geometry_hash=site.geometry_hash,
        results=[
            IngestionResultRead(
                source_id=result.source_id,
                run_id=result.run_id,
                status=result.status,
                error=result.error,
                observation_count=len(result.records),
            )
            for result in results
        ],
        observations=[ObservationRead.model_validate(observation) for observation in observations],
    )
    if results and all(result.status == "failed" for result in results):
        return JSONResponse(status_code=502, content=jsonable_encoder(payload))
    return payload


@router.get("/{site_id}/observations", response_model=ObservationList)
def site_observations(
    site_id: UUID,
    source_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """Return the stored observations for a candidate, without re-fetching anything."""
    site = _site_or_404(session, site_id)
    observations = _site_observations(session, site.id, source_id)
    return {
        "items": [ObservationRead.model_validate(observation) for observation in observations],
        "total": len(observations),
    }
