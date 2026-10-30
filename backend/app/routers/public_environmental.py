"""Read-only public environmental context endpoints.

The service is injected through application state. HTTP requests only query
cached repository data; they never call CPCB, IMD, NWDP or another provider.
"""
from __future__ import annotations

from collections.abc import Sequence
from uuid import uuid4

from fastapi import APIRouter, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from ..schemas.environmental_monitoring import (
    EnvironmentalCurrentResponse,
    EnvironmentalPoint,
    EnvironmentalProvenance,
    EnvironmentalRangeResponse,
    EnvironmentalSeries,
    EnvironmentalStateSummaryResponse,
    EnvironmentalSummaryMetric,
    MetricKey,
    RangeValue,
    SourceHealth,
    StationContext,
)
from ..schemas.public_facilities import ApiError, StateCode
from ..services.environmental_monitoring import (
    EnvironmentalFacilityNotFound,
    EnvironmentalMonitoringService,
    InvalidEnvironmentalQuery,
)
from ..services.environmental_sqlalchemy import EnvironmentalStorageError


class EnvironmentalMonitoringUnavailable(RuntimeError):
    pass


def _request_id(request: Request) -> str:
    supplied = request.headers.get("x-request-id", "").strip()
    return supplied[:100] if supplied else f"req_{uuid4().hex}"


def _error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, object] | None = None,
) -> JSONResponse:
    payload = ApiError.model_validate(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "requestId": _request_id(request),
            }
        }
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


class EnvironmentalContractRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def contract_handler(request: Request):
            try:
                return await handler(request)
            except RequestValidationError as error:
                fields = [
                    {
                        "path": ".".join(str(part) for part in item["loc"] if part not in {"query", "path", "body"}),
                        "message": item["msg"],
                    }
                    for item in error.errors()
                ]
                return _error_response(
                    request,
                    422,
                    "validation_failed",
                    "Request validation failed.",
                    {"fields": fields},
                )
            except EnvironmentalFacilityNotFound:
                return _error_response(request, 404, "facility_not_found", "Public facility not found.")
            except InvalidEnvironmentalQuery as error:
                return _error_response(request, 400, "invalid_request", str(error))
            except EnvironmentalMonitoringUnavailable:
                return _error_response(
                    request,
                    503,
                    "service_unavailable",
                    "Environmental monitoring data is not configured.",
                )
            except EnvironmentalStorageError:
                return _error_response(
                    request,
                    503,
                    "service_unavailable",
                    "Environmental monitoring storage is temporarily unavailable.",
                )

        return contract_handler


router = APIRouter(tags=["Public environmental monitoring"], route_class=EnvironmentalContractRoute)


def get_environmental_service(request: Request) -> EnvironmentalMonitoringService:
    service = getattr(request.app.state, "environmental_monitoring_service", None)
    if service is None:
        raise EnvironmentalMonitoringUnavailable()
    return service


def _parse_metrics(value: str | None) -> tuple[str, ...] | None:
    if value is None:
        return None
    metrics = tuple(dict.fromkeys(part.strip() for part in value.split(",") if part.strip()))
    if not metrics:
        raise InvalidEnvironmentalQuery("At least one metric is required")
    return metrics


def _station(value) -> StationContext | None:
    if value is None:
        return None
    return StationContext(
        stationId=value.station_id,
        name=value.name,
        provider=value.provider,
        sourceId=value.source_id,
        publicCoordinates=value.public_coordinates,
        stationType=value.station_type,
        distanceKm=value.distance_km,
        selectionMethod=value.selection_method,
        effectiveAt=value.effective_at,
    )


def _provenance(value) -> EnvironmentalProvenance | None:
    if value is None:
        return None
    return EnvironmentalProvenance(
        sourceId=value.source_id,
        provider=value.provider,
        dataset=value.dataset,
        sourceUrl=value.source_url,
        retrievedAt=value.retrieved_at,
        evidenceClass=value.evidence_class,
        temporalClass=value.temporal_class,
        visibility=value.visibility,
    )


def _current_metric(value) -> dict:
    return {
        "metric": value.metric,
        "displayName": value.display_name,
        "value": value.value,
        "unit": value.unit,
        "originalValue": getattr(value, "original_value", None),
        "originalUnit": getattr(value, "original_unit", None),
        "availability": value.availability,
        "quality": value.quality,
        "observedAt": value.observed_at,
        "publishedAt": value.published_at,
        "retrievedAt": value.retrieved_at,
        "freshUntil": value.fresh_until,
        "qualityFlags": list(value.quality_flags),
        "station": _station(value.station),
        "provenance": _provenance(value.provenance),
        "contextNotice": value.context_notice,
    }


def _series(value) -> EnvironmentalSeries:
    points = [
        EnvironmentalPoint(
            timestamp=point.timestamp,
            value=point.value,
            originalValue=getattr(point, "original_value", None),
            originalUnit=getattr(point, "original_unit", None),
            minimum=point.minimum,
            maximum=point.maximum,
            sampleCount=point.sample_count,
            coverageFraction=point.coverage_fraction,
            qualityFlags=list(point.quality_flags),
        )
        for point in value.points
    ]
    return EnvironmentalSeries(
        metric=value.metric,
        displayName=value.display_name,
        unit=value.unit,
        availability=value.availability,
        quality=value.quality,
        coverageFraction=value.coverage_fraction,
        expectedSampleCount=value.expected_sample_count,
        validSampleCount=value.valid_sample_count,
        station=_station(value.station),
        provenance=_provenance(value.provenance),
        points=points,
        contextNotice=value.context_notice,
    )


ERROR_RESPONSES = {
    400: {"model": ApiError},
    404: {"model": ApiError},
    422: {"model": ApiError},
    503: {"model": ApiError},
}


@router.get(
    "/public-facilities/{facility_id}/environmental/current",
    response_model=EnvironmentalCurrentResponse,
    responses=ERROR_RESPONSES,
)
def current_environmental_context(
    request: Request,
    facility_id: str = Path(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100),
    metrics: str | None = Query(default=None, max_length=500),
) -> EnvironmentalCurrentResponse:
    result = get_environmental_service(request).get_current(facility_id, _parse_metrics(metrics))
    return EnvironmentalCurrentResponse(
        facilityId=result.facility_id,
        generatedAt=result.generated_at,
        metrics=[_current_metric(metric) for metric in result.metrics],
    )


@router.get(
    "/public-facilities/{facility_id}/environmental",
    response_model=EnvironmentalRangeResponse,
    responses=ERROR_RESPONSES,
)
def environmental_range(
    request: Request,
    facility_id: str = Path(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100),
    metrics: str = Query(min_length=1, max_length=500),
    range_key: RangeValue = Query(default="24h", alias="range"),
    interval: str = Query(default="auto", pattern="^(auto|raw|hour|day)$"),
) -> EnvironmentalRangeResponse:
    result = get_environmental_service(request).get_range(
        facility_id,
        _parse_metrics(metrics) or (),
        range_key,
        interval,
    )
    return EnvironmentalRangeResponse.model_validate(
        {
            "facilityId": result.facility_id,
            "range": result.range,
            "interval": result.interval,
            "from": result.from_at,
            "to": result.to_at,
            "generatedAt": result.generated_at,
            "series": [_series(item) for item in result.series],
        }
    )


@router.get(
    "/environmental/summary",
    response_model=EnvironmentalStateSummaryResponse,
    responses=ERROR_RESPONSES,
)
def environmental_state_summary(
    request: Request,
    state: StateCode,
    range_key: RangeValue = Query(default="24h", alias="range"),
    metrics: str | None = Query(default=None, max_length=500),
) -> EnvironmentalStateSummaryResponse:
    result = get_environmental_service(request).get_state_summary(
        state,
        _parse_metrics(metrics),
        range_key,
    )
    return EnvironmentalStateSummaryResponse(
        stateCode=result.state_code,
        range=result.range,
        generatedAt=result.generated_at,
        facilityCount=result.facility_count,
        coveredFacilityCount=result.covered_facility_count,
        metrics=[
            EnvironmentalSummaryMetric(
                metric=item.metric,
                displayName=item.display_name,
                unit=item.unit,
                availability=item.availability,
                coveredFacilityCount=item.covered_facility_count,
                currentFacilityCount=item.current_facility_count,
                staleFacilityCount=item.stale_facility_count,
                unavailableFacilityCount=item.unavailable_facility_count,
                minimum=item.minimum,
                maximum=item.maximum,
                mean=item.mean,
                aggregationMethod=item.aggregation_method,
                contextNotice=item.context_notice,
            )
            for item in result.metrics
        ],
        sourceHealth=[
            SourceHealth(
                sourceId=item.source_id,
                status=item.status,
                lastCheckedAt=item.last_checked_at,
                lastSuccessAt=item.last_success_at,
            )
            for item in result.source_health
        ],
    )
