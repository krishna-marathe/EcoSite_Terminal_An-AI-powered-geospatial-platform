"""ML Predictions API endpoints for data centre requirements forecasting."""
from __future__ import annotations

import os
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.ml_service import predict_requirements

router = APIRouter(prefix="/ml", tags=["ML Predictions"])


class MLPredictionRequest(BaseModel):
    """Request model for ML predictions."""
    capacity_mw: float = Field(
        ..., ge=0, description="Current capacity in MW"
    )
    water_demand_kl_day: float = Field(
        ..., ge=0, description="Current water demand in kL/day"
    )
    power_demand_mw: float = Field(
        ..., ge=0, description="Current power demand in MW"
    )
    location: str = Field(
        default="IN-MH",
        description="Indian state code (IN-MH, IN-TG, IN-KA, IN-TN)",
    )
    months_ahead: Literal[6, 9, 12] = Field(
        6, description="Prediction horizon in months"
    )
    model_version: str = Field(
        "ML-F2.1",
        description="ML model version (ML-F2.1, ML-F3.4, ML-F4.1)",
    )


class MLPredictionResponse(BaseModel):
    """Response model for ML predictions."""
    power_demand_mw_pred: float
    water_demand_kl_day_pred: float
    capacity_mw_pred: float
    confidence_score: float
    prediction_horizon_months: int
    model_name: str
    timestamp: str
    input_summary: dict


@router.post("/predict", response_model=MLPredictionResponse)
async def predict_ml_requirements(
    request: MLPredictionRequest,
) -> MLPredictionResponse:
    """Predict data centre requirements for future months."""
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
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", response_model=List[str])
async def list_ml_models() -> List[str]:
    """List available ML model versions."""
    ml_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "ml"
    )
    if os.path.exists(ml_dir):
        files = [
            f.replace(".txt", "")
            for f in os.listdir(ml_dir)
            if f.endswith(".txt")
        ]
        if files:
            return files
    return ["ML-F2.1", "ML-F3.4", "ML-F4.1"]


@router.get("/model-info/{model_version}")
async def model_info(model_version: str) -> dict:
    """Get information about a specific ML model."""
    models_info = {
        "ML-F2.1": {
            "name": "Infrastructure Risk v2.1",
            "description": "Predicts power and water requirements for data centres",
            "training_date": "2024-01-15",
            "accuracy": "94.2%",
            "features": [
                "capacity_mw",
                "water_kl_day",
                "power_mw",
                "location",
                "horizon_months",
            ],
        },
        "ML-F3.4": {
            "name": "Environmental Stress v3.4",
            "description": "Predicts environmental impact and sustainability metrics",
            "training_date": "2024-03-20",
            "accuracy": "91.8%",
            "features": [
                "capacity_mw",
                "water_kl_day",
                "power_mw",
                "location",
                "horizon_months",
            ],
        },
        "ML-F4.1": {
            "name": "Population Forecast v4.1",
            "description": "Predicts population impact and regional demand",
            "training_date": "2024-06-10",
            "accuracy": "89.5%",
            "features": [
                "capacity_mw",
                "water_kl_day",
                "power_mw",
                "location",
                "horizon_months",
            ],
        },
    }

    if model_version in models_info:
        return models_info[model_version]
    raise HTTPException(status_code=404, detail="Model version not found")
