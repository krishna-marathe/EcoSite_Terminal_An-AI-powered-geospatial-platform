"""Public environmental risk score for one facility.

The score is computed on demand from live keyless provider context and the
thresholds in ``services.risk_scoring``. Nothing is persisted and nothing is
invented: a provider that fails produces explicit missing parameters.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..schemas.public_facilities import ApiError
from ..schemas.risk import RiskParameter, RiskScoreResponse
from ..services import facility_context
from ..services.public_facilities import PublicFacilityNotFound
from ..services.public_facility_sqlalchemy import PublicRegistryDataError
from ..services.risk_scoring import assess
from .public_facilities import get_public_facility_service

router = APIRouter(prefix="/public-facilities", tags=["Environmental risk score"])

ERROR_RESPONSES = {
    404: {"model": ApiError, "description": "Facility is missing, expired or not publishable."},
    503: {"model": ApiError, "description": "Configured registry persistence is unavailable."},
}


def _field(value: Any, name: str) -> Any:
    if isinstance(value, dict):
        return value.get(name)
    return getattr(value, name, None)


@router.get(
    "/{facility_id}/risk-score",
    response_model=RiskScoreResponse,
    responses=ERROR_RESPONSES,
    summary="Environmental risk score (0-100) with per-parameter breakdown",
)
def facility_risk_score(facility_id: str, request: Request) -> RiskScoreResponse:
    service = get_public_facility_service(request)
    try:
        facility = service.get_facility(facility_id)
    except PublicFacilityNotFound as error:
        raise HTTPException(
            status_code=404,
            detail={"code": "facility_not_found", "message": str(error) or "Public facility not found."},
        ) from error
    except PublicRegistryDataError as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "registry_unavailable", "message": "The public facility registry is unavailable."},
        ) from error

    coordinates = _field(facility, "publicCoordinates")
    if not coordinates or len(tuple(coordinates)) != 2:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "coordinates_unavailable",
                "message": "This facility has no generalised public coordinates, so no contextual risk score can be computed.",
            },
        )
    longitude, latitude = (float(value) for value in coordinates)

    context = facility_context.collect(latitude, longitude)
    assessment = assess(
        str(_field(facility, "id") or facility_id),
        context.readings,
        datetime.now(timezone.utc),
        extra_notes=tuple(f"Provider error: {error}" for error in context.errors),
    )

    return RiskScoreResponse(
        facilityId=assessment.facility_id,
        score=assessment.score,
        band=assessment.band,  # type: ignore[arg-type]
        coverage=assessment.coverage,
        availableWeight=assessment.available_weight,
        confidence=assessment.confidence,  # type: ignore[arg-type]
        scoreVersion=assessment.score_version,
        generatedAt=assessment.generated_at,
        parameters=[
            RiskParameter(
                key=parameter.key,
                label=parameter.label,
                unit=parameter.unit,
                weight=parameter.weight,
                value=parameter.value,
                score=parameter.score,
                status=parameter.status,  # type: ignore[arg-type]
                note=parameter.note,
                reason=parameter.reason,
                observedAt=parameter.observed_at,
                provider=parameter.provider,
                sourceUrl=parameter.source_url,
                quality=parameter.quality,
                detail=parameter.detail,
            )
            for parameter in assessment.parameters
        ],
        notes=list(assessment.notes),
        providerErrors=list(context.errors),
    )
