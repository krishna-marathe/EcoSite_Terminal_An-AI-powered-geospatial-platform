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

    # 3. Phased Capacity & Resource Ramp across Planning Horizons
    # 6-month: baseline initial phase (1.00x)
    # 9-month: intermediate tenant expansion ramp (1.125x)
    # 12-month: full campus design capacity ramp (1.250x)
    if months_ahead == 6:
        ramp_factor = 1.000
        seasonal_water_factor = 1.35  # Peak summer thermal surge multiplier
    elif months_ahead == 9:
        ramp_factor = 1.125
        seasonal_water_factor = 0.90  # Monsoon cooling relief
    elif months_ahead == 12:
        ramp_factor = 1.250
        seasonal_water_factor = 1.00  # Annual average baseline
    else:
        ramp_factor = round(1.0 + max(0, months_ahead - 6) * 0.04167, 3)
        seasonal_water_factor = 1.00

    c_pred = round(capacity_mw * ramp_factor, 2)
    p_pred = round(base_power * ramp_factor, 2)

    # 4. Strict Refusal to Fabricate Water Demand when Undisclosed
    # Calculate explicit engineering cooling benchmark (BIS IS 15797 / OpenDC-LCA baseline: WUE 1.20 L/kWh, 80% CF)
    wue_baseline = 1.20
    cf_baseline = 0.80
    w_benchmark = round(c_pred * cf_baseline * 24 * wue_baseline * seasonal_water_factor, 2) if c_pred > 0 else 0.0

    cooling_options = {
        "evaporative_hybrid_kld": round(c_pred * cf_baseline * 24 * 1.20 * seasonal_water_factor, 2),
        "air_cooled_dry_kld": round(c_pred * cf_baseline * 24 * 0.05 * seasonal_water_factor, 2),
        "liquid_dlc_kld": round(c_pred * cf_baseline * 24 * 0.25 * seasonal_water_factor, 2),
        "immersion_cooling_kld": round(c_pred * cf_baseline * 24 * 0.02 * seasonal_water_factor, 2),
    } if c_pred > 0 else {}

    notes = [
        f"Deterministic facility engineering scenario for {months_ahead}-month planning horizon.",
        f"Phased capacity ramp factor: {ramp_factor:.3f}x applied to baseline IT load.",
        "Standard Indian operational PUE benchmark (1.35) applied.",
    ]

    if water_demand_kl_day > 0:
        w_pred = round(water_demand_kl_day * ramp_factor, 2)
        notes.append(f"Water demand projected based on reported baseline ({water_demand_kl_day} kL/day).")
    else:
        w_pred = None
        notes.append(
            "Operator WUE and water consumption are not publicly disclosed. EcoSite refuses to fabricate synthetic water consumption as measured data."
        )
        notes.append(
            f"Engineering cooling benchmark provides estimated make-up water requirement ({w_benchmark:.1f} kL/day for Evaporative Hybrid baseline, 1.20 L/kWh WUE, 80% CF)."
        )

    return {
        "status": "OK",
        "classification": "DETERMINISTIC_ENGINEERING_SCENARIO",
        "power_demand_mw_pred": p_pred,
        "water_demand_kl_day_pred": w_pred,
        "benchmark_cooling_water_kl_day": w_benchmark,
        "benchmark_cooling_options": cooling_options,
        "capacity_mw_pred": c_pred,
        "pue_applied": 1.35,
        "wue_applied": wue_baseline,
        "cooling_architecture_assumed": "Evaporative Hybrid Towers (Engineering Benchmark)",
        "confidence_score": None,  # No fabricated statistical confidence on engineering heuristics
        "prediction_horizon_months": months_ahead,
        "model_name": model_name,
        "timestamp": datetime.utcnow().isoformat(),
        "provenance_note": " ".join(notes),
        "input_summary": input_summary,
    }
