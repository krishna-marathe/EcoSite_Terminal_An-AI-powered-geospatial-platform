"""
EcoSite Resource Outlook — Facility Engineering Scenario Modeling & Regional ML Inference Service.

Epistemic limits (AGENTS.md):
- Missing/undisclosed WUE means water consumption is UNKNOWN / NOT_DISCLOSED, NEVER fabricated.
- Supervised ML models in ml/resource_outlook/models/ are Maharashtra macro-grid demand models,
  NOT facility-level predictors. Regional grid context must be obtained via /resource-outlook or regional endpoints.
- Never outputs arbitrary confidence percentages (e.g. 0.85) for deterministic engineering calculations.
- Unspecified facility capacity boundaries (e.g. STT Pune 5: 24 MW) must be evaluated as dual engineering
  scenarios (Intake Boundary vs IT Boundary) rather than asserting an unverified firm power gap.
"""
from __future__ import annotations

import os
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

# Resolved path to genuine regional LightGBM models
BASE_DIR = Path(__file__).resolve().parents[3]
ML_MODEL_DIR = BASE_DIR / "ml" / "resource_outlook" / "models"
DATA_DIR = BASE_DIR / "ml" / "resource_outlook" / "electricity_recent"

# Global model cache to avoid repeated disk I/O on live requests
_CACHED_BOOSTER = None
_CACHED_HISTORY = None
_CACHED_CLIMO = None


def get_lgbm_booster():
    """Lazily loads and caches the production LightGBM booster artifact."""
    global _CACHED_BOOSTER
    if _CACHED_BOOSTER is None:
        import lightgbm as lgb
        model_path = ML_MODEL_DIR / "v3" / "lgbm_demand_production_v3.txt"
        if not model_path.exists():
            raise FileNotFoundError(f"LightGBM production model not found at {model_path}")
        _CACHED_BOOSTER = lgb.Booster(model_file=str(model_path))
    return _CACHED_BOOSTER


def get_electricity_history_and_climo():
    """Lazily loads and caches historical combined electricity series and ERA5 climatology."""
    global _CACHED_HISTORY, _CACHED_CLIMO
    if _CACHED_HISTORY is None or _CACHED_CLIMO is None:
        from ml.resource_outlook.electricity_recent.train_and_evaluate_electricity_v3 import (
            load_data,
            get_static_climatology,
        )
        _CACHED_HISTORY = load_data()
        _CACHED_CLIMO = get_static_climatology()
    return _CACHED_HISTORY, _CACHED_CLIMO


def predict_regional_electricity_lgbm(target_date: str) -> Dict[str, Any]:
    """
    Executes live LightGBM booster inference for a target date using the genuine
    ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt artifact.

    Computes:
    - 20 meteorological, calendar, and historical lag features
    - Seasonal Naive baseline (364-day lag)
    - LightGBM residual correction
    - Combined predicted peak met (MW)
    """
    import numpy as np
    import pandas as pd
    from ml.resource_outlook.electricity_recent.train_and_evaluate_electricity_v3 import extract_features

    # Parse and validate target date
    try:
        dt = pd.Timestamp(target_date)
    except Exception as e:
        raise ValueError(f"Invalid target date '{target_date}': {e}")

    origin_date = "2026-10-27"
    origin = pd.Timestamp(origin_date)
    lead_days = (dt - origin).days

    if lead_days < 1:
        raise ValueError(f"Target date {target_date} must be strictly after forecast origin {origin_date}.")

    booster = get_lgbm_booster()
    df_history, climo_table = get_electricity_history_and_climo()

    # Known data at origin
    df_known = df_history.loc[:origin_date]

    # Extract 20 features
    feat_dict = extract_features(dt, origin_date, df_known, climo_table)
    feature_cols = booster.feature_name()

    # Verify all feature values
    missing_feats = [c for c in feature_cols if c not in feat_dict or pd.isna(feat_dict[c])]
    if missing_feats:
        raise ValueError(f"Unable to extract required LightGBM features: {missing_feats}")

    feature_vector = [float(feat_dict[c]) for c in feature_cols]
    x_matrix = np.array([feature_vector])

    # Run LightGBM Booster inference
    residual_pred_mw = float(booster.predict(x_matrix)[0])
    base_naive_mw = float(feat_dict["lag_364d_mw"])
    total_pred_lgbm_mw = round(base_naive_mw + residual_pred_mw, 2)

    # Determine horizon validity status
    if lead_days <= 182:
        horizon_status = "OPERATIONALLY_BACKTESTED_HORIZON"
        horizon_notice = "Within 182-day (26-week) horizon evaluated across 7 chronological backtest windows."
    elif lead_days <= 365:
        horizon_status = "PROVISIONAL_EXTENDED_HORIZON"
        horizon_notice = (
            "Extended horizon (9-12 months). LightGBM was trained with max lead_days 182; "
            "projections beyond 182 days carry compounding multi-season uncertainty and lack 1-year holdout backtesting."
        )
    else:
        horizon_status = "UNSUPPORTED_HORIZON"
        horizon_notice = "Horizons beyond 365 days are completely unvalidated."

    return {
        "status": "OK",
        "scope": "MAHARASHTRA_MACRO_GRID_PEAK_MET",
        "target_date": dt.strftime("%Y-%m-%d"),
        "origin_date": origin_date,
        "lead_days": lead_days,
        "lead_weeks": round(lead_days / 7.0, 1),
        "horizon_status": horizon_status,
        "horizon_notice": horizon_notice,
        "predictions": {
            "lightgbm_predicted_peak_met_mw": total_pred_lgbm_mw,
            "seasonal_naive_baseline_mw": round(base_naive_mw, 2),
            "lightgbm_residual_adjustment_mw": round(residual_pred_mw, 2),
        },
        "model_metadata": {
            "model_artifact": "ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt",
            "model_type": "LightGBM Regressor (GBDT L1 Residual Booster)",
            "num_trees": booster.num_trees(),
            "num_features": booster.num_feature(),
            "objective": "regression_l1",
            "learning_rate": 0.03,
            "backtest_7window_mae_mw": 1825.61,
            "backtest_7window_mape_pct": 7.10,
            "recent_3window_mae_mw": 1288.79,
            "operational_model_comparison": {
                "selected_operational_model": "SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS",
                "operational_7window_mae_mw": 1749.68,
                "operational_7window_mape_pct": 6.76,
                "reason_for_selection": (
                    "Seasonal Naive achieved lower average error across all 7 backtest windows (1749.68 MW vs 1825.61 MW) "
                    "due to LightGBM sensitivity during anomalous Monsoon 2023 spikes, despite LightGBM superior accuracy "
                    "on the three most recent holdout windows (2024-2026)."
                ),
            },
        },
        "features": {c: round(feat_dict[c], 4) for c in feature_cols},
        "provenance": {
            "historical_data_source": "Maharashtra State Load Despatch Centre (MSLDC) daily reports (2013-2026, 4,958 records)",
            "climatology_source": "ERA5 Reanalysis (1991-2020 Maharashtra spatial average)",
            "epistemic_guard": "Regional transmission demand only. Not facility telemetry or local substation headroom.",
        },
    }


def predict_requirements(
    model_name: str,
    capacity_mw: float,
    water_demand_kl_day: float,
    power_demand_mw: float,
    location: str = "IN-MH",
    months_ahead: int = 6,
    capacity_boundary: Optional[str] = None,
    cooling_system_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes facility engineering capacity and power demand projections.
    Does NOT fabricate unmeasured water demands or return false statistical confidence scores.

    Handles unspecified capacity boundaries transparently by generating dual engineering scenarios
    (Scenario A: Total Intake Boundary vs Scenario B: IT Load Boundary).
    """
    input_summary = {
        "capacity_mw": capacity_mw,
        "water_demand_kl_day": water_demand_kl_day,
        "power_demand_mw": power_demand_mw,
        "location": location,
        "months_ahead": months_ahead,
        "model_version": model_name,
        "capacity_boundary": capacity_boundary,
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
    # Calculate explicit engineering cooling benchmark based on cooling architecture
    cf_baseline = 0.80
    cooling_upper = (cooling_system_type or "").upper()
    if "DX" in cooling_upper:
        wue_baseline = 0.00
        w_benchmark = 0.0
    elif "AIR_COOLED" in cooling_upper or "CHILLED_WATER_AIR_COOLED" in cooling_upper:
        wue_baseline = 0.05
        w_benchmark = round(c_pred * cf_baseline * 24 * wue_baseline * seasonal_water_factor, 2) if c_pred > 0 else 0.0
    else:
        wue_baseline = 1.20
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

    # Handle boundary status
    is_unspecified = capacity_boundary in ("power_capacity_unspecified", "unspecified", None) and power_demand_mw <= 0
    boundary_scenarios = None

    if capacity_boundary == "power_capacity_unspecified":
        boundary_status = "UNSPECIFIED_BOUNDARY"
        notes.append(
            f"Public disclosure states {capacity_mw:.1f} MW without specifying whether it represents IT load, "
            "critical power, or total utility grid sanction. Dual what-if scenarios are provided."
        )
        # Scenario A: treats capacity as total grid intake -> backs out IT load
        it_from_intake = round(c_pred / 1.35, 2)
        power_from_intake = c_pred
        water_from_intake = round(it_from_intake * cf_baseline * 24 * wue_baseline * seasonal_water_factor, 2)

        # Scenario B: treats capacity as IT load -> scales up total power
        it_from_it = c_pred
        power_from_it = round(c_pred * 1.35, 2)
        water_from_it = w_benchmark

        boundary_scenarios = {
            "scenario_a_intake_boundary": {
                "interpretation": f"Treats {capacity_mw:.1f} MW as total utility grid power sanction.",
                "derived_it_capacity_mw": it_from_intake,
                "derived_power_demand_mw": power_from_intake,
                "benchmark_cooling_water_kld": water_from_intake,
                "assumed_pue": 1.35,
                "note": "Backed out IT load at benchmark 1.35 PUE. No utility headroom deficit asserted.",
            },
            "scenario_b_it_load_boundary": {
                "interpretation": f"Treats {capacity_mw:.1f} MW as design IT load capacity.",
                "derived_it_capacity_mw": it_from_it,
                "derived_power_demand_mw": power_from_it,
                "benchmark_cooling_water_kld": water_from_it,
                "assumed_pue": 1.35,
                "note": "Total grid power required at benchmark 1.35 PUE.",
            },
        }
    else:
        boundary_status = "DECLARED_OR_SPECIFIED"

    if water_demand_kl_day > 0:
        w_pred = round(water_demand_kl_day * ramp_factor, 2)
        notes.append(f"Water demand projected based on reported baseline ({water_demand_kl_day} kL/day).")
    else:
        w_pred = None
        notes.append(
            "Operator WUE and water consumption are not publicly disclosed. EcoSite refuses to fabricate synthetic water consumption as measured data."
        )
        notes.append(
            f"Engineering cooling benchmark provides estimated make-up water requirement ({w_benchmark:.1f} kL/day for Evaporative Hybrid baseline, 1.20 L/kWh WUE, 80% CF applied to IT energy)."
        )

    return {
        "status": "OK",
        "classification": "DETERMINISTIC_ENGINEERING_SCENARIO",
        "capacity_boundary_status": boundary_status,
        "boundary_scenarios": boundary_scenarios,
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
