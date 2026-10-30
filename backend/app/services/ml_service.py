"""
EcoSite Resource Outlook — Facility Engineering Scenario Modeling Service.
Provides transparent, deterministic engineering projections based on declared capacity,
benchmark PUE (1.35), and explicit inputs.

Epistemic limits (AGENTS.md):
- Missing/undisclosed WUE means water consumption is UNKNOWN / NOT_DISCLOSED, NEVER fabricated.
- Supervised ML models in ml/resource_outlook/models/ are Maharashtra macro-grid demand models,
  NOT facility-level predictors. Regional grid context must be obtained via /resource-outlook.
- Never outputs arbitrary confidence percentages (e.g. 0.85) for deterministic engineering calculations.
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Resolved path to genuine regional LightGBM models
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_MODEL_DIR = BASE_DIR / "ml" / "resource_outlook" / "models"


def predict_requirements(
    model_name: str,
    capacity_mw: float,
    water_demand_kl_day: float,
    power_demand_mw: float,
    location: str = "IN-MH",
    months_ahead: int = 6,
) -> Dict[str, Any]:
    """
    Computes facility engineering capacity and power demand projections.
    Does NOT fabricate unmeasured water demands or return false statistical confidence scores.
    """
    input_summary = {
        "capacity_mw": capacity_mw,
        "water_demand_kl_day": water_demand_kl_day,
        "power_demand_mw": power_demand_mw,
        "location": location,
        "months_ahead": months_ahead,
        "model_version": model_name,
    }

    # 1. Reject insufficient data when facility capacity and power are both unspecified
    if capacity_mw <= 0 and power_demand_mw <= 0:
        return {
            "status": "INSUFFICIENT_INPUT_DATA",
            "classification": "INSUFFICIENT_DATA",
            "power_demand_mw_pred": None,
            "water_demand_kl_day_pred": None,
            "capacity_mw_pred": None,
            "confidence_score": None,
            "prediction_horizon_months": months_ahead,
            "model_name": model_name,
            "timestamp": datetime.utcnow().isoformat(),
            "provenance_note": (
                "Facility capacity or power demand must be strictly greater than 0 "
                "to evaluate engineering resource requirements."
            ),
            "input_summary": input_summary,
        }

    # 2. Deterministic Power Demand Projection based on PUE benchmark
    # Standard Indian data centre operational PUE benchmark: 1.35
    if power_demand_mw > 0:
        base_power = power_demand_mw
    else:
        base_power = round(capacity_mw * 1.35, 2)

    # 3. Transparent Horizon Capacity
    # For planning horizons, scale deterministic planned capacity linearly if requested
    c_pred = round(capacity_mw, 2)
    p_pred = round(base_power, 2)

    # 4. Strict Refusal to Fabricate Water Demand when Undisclosed
    notes = [
        "Deterministic facility engineering scenario based on declared IT capacity and standard PUE benchmark (1.35).",
        "Regional macro-grid electricity stress and Bhatsa reservoir status must be referenced via /api/v1/resource-outlook.",
    ]

    if water_demand_kl_day > 0:
        w_pred = round(water_demand_kl_day, 2)
    else:
        w_pred = None
        notes.append(
            "WUE and water consumption are not publicly disclosed. EcoSite refuses to fabricate synthetic water consumption."
        )

    return {
        "status": "OK",
        "classification": "DETERMINISTIC_ENGINEERING_SCENARIO",
        "power_demand_mw_pred": p_pred,
        "water_demand_kl_day_pred": w_pred,
        "capacity_mw_pred": c_pred,
        "confidence_score": None,  # No fabricated statistical confidence on engineering heuristics
        "prediction_horizon_months": months_ahead,
        "model_name": model_name,
        "timestamp": datetime.utcnow().isoformat(),
        "provenance_note": " ".join(notes),
        "input_summary": input_summary,
    }
