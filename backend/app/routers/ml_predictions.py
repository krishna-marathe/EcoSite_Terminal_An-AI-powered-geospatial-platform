"""ML Predictions & Facility Engineering Scenarios API endpoints."""
from __future__ import annotations

import os
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.ml_service import predict_requirements

router = APIRouter(prefix="/ml", tags=["ML Predictions"])


class MLPredictionRequest(BaseModel):
    """Request model for facility engineering scenarios."""
    capacity_mw: float = Field(
        ..., ge=0, description="Current capacity in MW"
    )
    water_demand_kl_day: float = Field(
        default=0.0, ge=0, description="Current water demand in kL/day (0 if undisclosed)"
    )
    power_demand_mw: float = Field(
        default=0.0, ge=0, description="Current power demand in MW (0 to derive from capacity * PUE)"
    )
    location: str = Field(
        default="IN-MH",
        description="Indian state code (IN-MH, IN-TG, IN-KA, IN-TN)",
    )
    months_ahead: Literal[6, 9, 12] = Field(
        6, description="Planning horizon in months"
    )
    model_version: str = Field(
        "ML-F4.1",
        description="Module identifier (ML-F2.1, ML-F3.4, ML-F4.1)",
    )


class MLPredictionResponse(BaseModel):
    """Response model for facility engineering scenarios with epistemic transparency."""
    power_demand_mw_pred: Optional[float] = None
    water_demand_kl_day_pred: Optional[float] = None
    capacity_mw_pred: Optional[float] = None
    confidence_score: Optional[float] = None
    prediction_horizon_months: int
    model_name: str
    timestamp: str
    input_summary: dict
    status: str = "OK"
    classification: str = "DETERMINISTIC_ENGINEERING_SCENARIO"
    provenance_note: str = ""


@router.post("/predict", response_model=MLPredictionResponse)
async def predict_ml_requirements(
    request: MLPredictionRequest,
) -> MLPredictionResponse:
    """Evaluate facility engineering requirements with transparent epistemic guards."""
    try:
        result = predict_requirements(
            model_name=request.model_version,
            capacity_mw=request.capacity_mw,
            water_demand_kl_day=request.water_demand_kl_day,
            power_demand_mw=request.power_demand_mw,
            location=request.location,
            months_ahead=request.months_ahead,
        )
        return MLPredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", response_model=List[str])
async def list_ml_models() -> List[str]:
    """List available Resource Outlook ML and engineering modules."""
    return ["ML-F2.1", "ML-F3.4", "ML-F4.1"]


@router.get("/model-info/{model_version}")
async def model_info(model_version: str) -> dict:
    """Get authoritative metadata and provenance about a Resource Outlook module."""
    models_info = {
        "ML-F2.1": {
            "name": "Maharashtra Grid Peak Demand Model (ML-F2.1)",
            "description": (
                "Regional macro-grid daily peak demand forecasting combining 2013-2024 Zenodo "
                "and 2024-2026 MSLDC operational reports. Evaluated across 7 chronological backtest windows."
            ),
            "training_date": "2026-10-30",
            "evaluated_mae_mw": 1749.68,
            "evaluated_mape_pct": 6.76,
            "scope": "REGIONAL_MACRO_GRID_ONLY",
            "features": [
                "historical_52w_lag",
                "annual_growth_trend",
                "era5_climatology",
                "calendar_seasonality",
            ],
        },
        "ML-F3.4": {
            "name": "Bhatsa Dam Water Storage Assessment (ML-F3.4)",
            "description": (
                "Continuous CWC weekly bulletin monitoring of Bhatsa Lake (MMR supply basin). "
                "Provides dry-season drawdown backtests and illustrative depletion scenarios from 2026-10-29 benchmark."
            ),
            "training_date": "2026-10-30",
            "evaluated_mae_mcm": 39.85,
            "scope": "BASIN_RESERVOIR_STORAGE_ONLY",
            "features": [
                "cwc_weekly_live_storage",
                "ten_year_historical_normal",
                "dry_season_drawdown_profile",
            ],
        },
        "ML-F4.1": {
            "name": "Facility Resource Stress Engine (ML-F4.1)",
            "description": (
                "Deterministic facility engineering demand calculator combining IT MW, PUE (1.35), "
                "and contractual grid sanctions against regional macro constraints."
            ),
            "training_date": "2026-10-30",
            "scope": "FACILITY_DETERMINISTIC_ENGINEERING",
            "features": [
                "facility_it_mw",
                "pue_benchmark",
                "contracted_mva",
                "renewable_ppa_matching",
            ],
        },
    }

    if model_version in models_info:
        return models_info[model_version]
    raise HTTPException(status_code=404, detail="Model version not found")
