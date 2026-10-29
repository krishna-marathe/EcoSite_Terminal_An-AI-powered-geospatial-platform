"""Public operational-facility API backed by a persistence-neutral service."""
from __future__ import annotations
from ..schemas.ai_assist import FacilityAiAssistRequest, FacilityAiAssistResponse
from ..services.facility_context import collect as collect_environmental_context
from ..services.gemini_ai import generate_facility_ai_insights

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Path as ApiPath, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from ..schemas.public_facilities import (
    ApiError,
    FacilityType,
    PublicFacility,
    PublicFacilityPage,
    PublicFacilitySummary,
    PublicRegistry,
    StateCode,
)
from ..services.public_facilities import (
    FacilityFilters,
    JsonRegistryRepository,
    PageRequest,
    PublicFacilityNotFound,
    PublicFacilityService,
)
from ..services.public_facility_sqlalchemy import PublicRegistryDataError


DATA_FILE = Path(__file__).resolve().parents[3] / "data" / "public_data_centres.json"


def _request_id(request: Request) -> str:
    supplied = request.headers.get("x-request-id", "").strip()
    return supplied[:100] if supplied else f"req_{uuid4().hex}"


def _error_response(
    request: Request,
    *,
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


class PublicFacilityRoute(APIRoute):
    """Apply the frozen safe validation envelope to this router only."""

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
                    status_code=422,
                    code="validation_failed",
                    message="Request validation failed.",
                    details={"fields": fields},
                )
            except PublicRegistryDataError:
                return _error_response(
                    request,
                    status_code=503,
                    code="service_unavailable",
                    message="The public facility registry is temporarily unavailable.",
                )

        return contract_handler


router = APIRouter(
    prefix="/public-facilities",
    tags=["Public facility registry"],
    route_class=PublicFacilityRoute,
)


@lru_cache(maxsize=1)
def load_registry() -> PublicRegistry:
    """Compatibility loader used by validation tests and the temporary adapter."""
    return PublicRegistry.model_validate_json(DATA_FILE.read_text(encoding="utf-8"))


def _service(today=date.today) -> PublicFacilityService[PublicFacility]:
    repository = JsonRegistryRepository(DATA_FILE, PublicRegistry.model_validate_json)
    return PublicFacilityService(repository, today=today)


def get_public_facility_service(request: Request) -> PublicFacilityService:
    """Return the configured DB-backed service or the reviewed JSON transition adapter."""
    return getattr(request.app.state, "public_facility_service", None) or _service()


def publishable(facility: PublicFacility, as_of: date) -> bool:
    """Compatibility wrapper for the shared publication rule."""
    return PublicFacilityService.is_publishable(facility, as_of)


def current_public_facilities(as_of: date | None = None) -> list[PublicFacility]:
    """Compatibility helper; production routes use the paginated service methods."""
    effective_date = as_of or date.today()
    result = _service(today=lambda: effective_date).list_facilities(
        pagination=PageRequest(page=1, page_size=100)
    )
    return list(result.items)


ERROR_RESPONSES = {
    404: {"model": ApiError, "description": "Facility is missing, expired or not publishable."},
    422: {"model": ApiError, "description": "Request validation failed."},
    503: {"model": ApiError, "description": "Configured registry persistence is unavailable."},
}


@router.get("", response_model=PublicFacilityPage, responses={422: ERROR_RESPONSES[422], 503: ERROR_RESPONSES[503]})
def list_public_facilities(
    request: Request,
    state: StateCode | None = None,
    operator: str | None = Query(default=None, min_length=1, max_length=200),
    facility_type: FacilityType | None = Query(default=None, alias="facilityType"),
    q: str | None = Query(default=None, min_length=1, max_length=120),
    freshness: Literal["current"] = Query(default="current"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, alias="pageSize", ge=1, le=100),
) -> PublicFacilityPage:
    result = get_public_facility_service(request).list_facilities(
        FacilityFilters(
            state_code=state,
            operator=operator,
            facility_type=facility_type,
            query=q,
            freshness=freshness,
        ),
        PageRequest(page=page, page_size=page_size),
    )
    return PublicFacilityPage(
        items=list(result.items),
        page=result.page,
        pageSize=result.page_size,
        total=result.total,
        registryVersion=result.registry_version,
        asOf=result.as_of,
    )


@router.get("/summary", response_model=PublicFacilitySummary)
def public_facility_summary(request: Request) -> PublicFacilitySummary:
    result = get_public_facility_service(request).get_summary()
    return PublicFacilitySummary(
        registryVersion=result.registry_version,
        asOf=result.as_of,
        operationalFacilityCount=result.operational_facility_count,
        operatorCount=result.operator_count,
        byState=result.by_state,
        capacityAggregation="disabled_mixed_measurement_boundaries",
    )


@router.get("/{facility_id}", response_model=PublicFacility, responses=ERROR_RESPONSES)
def public_facility_detail(
    request: Request,
    facility_id: str = ApiPath(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100),
):
    try:
        return get_public_facility_service(request).get_facility(facility_id)
    except PublicFacilityNotFound:
        return _error_response(
            request,
            status_code=404,
            code="facility_not_found",
            message="Public facility not found.",
        )


@router.post("/{facility_id}/ai-assist", response_model=FacilityAiAssistResponse, responses=ERROR_RESPONSES)
def public_facility_ai_assist(
    request: Request,
    facility_id: str = ApiPath(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100),
    body: FacilityAiAssistRequest | None = None,
):
    try:
        facility = get_public_facility_service(request).get_facility(facility_id)
    except PublicFacilityNotFound:
        return _error_response(
            request,
            status_code=404,
            code="facility_not_found",
            message="Public facility not found.",
        )
    if hasattr(facility, "model_dump"):
        facility_dict = facility.model_dump(mode="json")
    else:
        facility_dict = dict(facility)
    coords = facility_dict.get("publicCoordinates") or [73.0, 19.0]
    lon, lat = coords[0], coords[1]
    env_data = {}
    try:
        env_result = collect_environmental_context(latitude=lat, longitude=lon)
        for key, item in env_result.readings.items():
            if hasattr(item, "value"):
                env_data[key] = {
                    "value": item.value,
                    "quality": getattr(item, "quality", "modelled"),
                    "provider": getattr(item, "provider", "Open-Meteo"),
                }
    except Exception:
        pass
    req_body = body or FacilityAiAssistRequest()
    return generate_facility_ai_insights(
        facility=facility_dict,
        environmental_data=env_data,
        focus_area=req_body.focus_area,
        custom_prompt=req_body.custom_prompt,
        force_model=req_body.force_model,
        inspection_mode=req_body.inspection_mode,
    )
