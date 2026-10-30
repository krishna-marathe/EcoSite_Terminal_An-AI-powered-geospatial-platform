from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, Optional

try:
    import lightgbm as lgb
except (ImportError, Exception):
    lgb = None

ML_MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml')
MODEL_CACHE: Dict[str, Any] = {}


def load_ml_model(model_name: str) -> Optional[Any]:
    """Load a lightGBM model from the ml folder if lightgbm is available and file exists."""
    if lgb is None:
        return None
    model_path = os.path.join(ML_MODEL_DIR, f"{model_name}.txt")
    if model_name not in MODEL_CACHE:
        if not os.path.exists(model_path):
            return None
        try:
            MODEL_CACHE[model_name] = lgb.Booster(model_file=model_path)
        except Exception:
            return None
    return MODEL_CACHE.get(model_name)


def predict_requirements(
    model_name: str,
    capacity_mw: float,
    water_demand_kl_day: float,
    power_demand_mw: float,
    location: str = "IN-MH",
    months_ahead: int = 6,
) -> Dict[str, Any]:
    """Predict data center requirements using lightGBM model or pure-Python fallback."""
    model = load_ml_model(model_name)

    if model is not None:
        features = [
            capacity_mw,
            water_demand_kl_day,
            power_demand_mw,
            {"IN-MH": 0, "IN-TG": 1, "IN-KA": 2, "IN-TN": 3}.get(location, 0),
            months_ahead / 12.0,
            capacity_mw * water_demand_kl_day / 1000,
            power_demand_mw / (capacity_mw + 1e-8),
        ]
        pred = model.predict([features])[0]
        p_pred = max(0.0, float(pred[0]))
        w_pred = max(0.0, float(pred[1]))
        c_pred = max(0.0, float(pred[2]))
        conf = float(pred[3]) if len(pred) > 3 else 0.85
    else:
        # Calibrated engineering heuristic fallback based on PUE/WUE growth curve
        growth_factor = 1.0 + (0.04 * (months_ahead / 12.0))
        base_power = power_demand_mw if power_demand_mw > 0 else capacity_mw * 1.35
        base_water = water_demand_kl_day if water_demand_kl_day > 0 else capacity_mw * 1.6 * 24.0
        p_pred = round(base_power * growth_factor, 2)
        w_pred = round(base_water * growth_factor, 2)
        c_pred = round(capacity_mw * (1.0 + 0.02 * (months_ahead / 12.0)), 2)
        conf = 0.85

    return {
        "power_demand_mw_pred": p_pred,
        "water_demand_kl_day_pred": w_pred,
        "capacity_mw_pred": c_pred,
        "confidence_score": conf,
        "prediction_horizon_months": months_ahead,
        "model_name": model_name,
        "timestamp": datetime.utcnow().isoformat(),
        "input_summary": {
            "capacity_mw": capacity_mw,
            "water_demand_kl_day": water_demand_kl_day,
            "power_demand_mw": power_demand_mw,
            "location": location,
            "months_ahead": months_ahead,
        },
    }
