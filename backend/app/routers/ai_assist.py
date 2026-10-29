"""Router for Gemini AI Assistant and Facility Intelligence."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Path as ApiPath, Request

from ..schemas.ai_assist import (
    AiServiceStatus,
    FacilityAiAssistRequest,
    FacilityAiAssistResponse,
)
from ..services.facility_context import collect as collect_environmental_context
from ..services.gemini_ai import (
    generate_facility_ai_insights,
    get_service_status,
)
from ..services.public_facilities import PublicFacilityNotFound
from .public_facilities import get_public_facility_service

logger = logging.getLogger("ecosite.routers.ai_assist")

router = APIRouter(prefix="/ai-assist", tags=["AI Assist"])


@router.get("/status", response_model=AiServiceStatus)
def ai_status() -> AiServiceStatus:
    """Return status of the server-side Gemini AI Assist engine."""
    return get_service_status()


@router.post("/facility/{facility_id}", response_model=FacilityAiAssistResponse)
def facility_ai_assist(
    request: Request,
    facility_id: str = ApiPath(min_length=3, max_length=100),
    body: FacilityAiAssistRequest | None = None,
) -> FacilityAiAssistResponse:
    """Generate grounded Gemini AI Assist evaluation for a specific operational facility."""
    service = get_public_facility_service(request)
    try:
        facility = service.get_facility(facility_id)
    except PublicFacilityNotFound:
        raise HTTPException(status_code=404, detail=f"Facility '{facility_id}' not found in registry.")

    if hasattr(facility, "model_dump"):
        facility_dict = facility.model_dump(mode="json")
    else:
        facility_dict = dict(facility)

    coords = facility_dict.get("publicCoordinates") or [73.0, 19.0]
    lon, lat = coords[0], coords[1]

    # Collect live/modelled environmental context for the facility coordinates
    env_data: dict[str, Any] = {}
    try:
        env_result = collect_environmental_context(latitude=lat, longitude=lon)
        for key, item in env_result.readings.items():
            if hasattr(item, "value"):
                env_data[key] = {
                    "value": item.value,
                    "quality": getattr(item, "quality", "modelled"),
                    "provider": getattr(item, "provider", "Open-Meteo"),
                }
    except Exception as e:
        logger.warning("Could not collect environmental context for (%s, %s): %s", lat, lon, e)

    req_body = body or FacilityAiAssistRequest()

    return generate_facility_ai_insights(
        facility=facility_dict,
        environmental_data=env_data,
        focus_area=req_body.focus_area,
        custom_prompt=req_body.custom_prompt,
        force_model=req_body.force_model,
        inspection_mode=req_body.inspection_mode,
    )
