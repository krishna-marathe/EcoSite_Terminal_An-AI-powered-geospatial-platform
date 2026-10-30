"""
EcoSite Resource Outlook — Seasonal-Naive Water Storage Baseline (ML-F3.3)
Implements fixed-origin 26-week backtesting for Bhatsa Reservoir and Maharashtra Statewide
storage on the held-out 2024-H1 evaluation window (Jan 4, 2024 to Jun 27, 2024)
using genuine 2023 historical weekly observations.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd

WATER_DIR = Path(__file__).resolve().parent
BHATSA_CAL_PATH = WATER_DIR / "bhatsa_weekly_continuous_calendar.csv"
STATE_CAL_PATH = WATER_DIR / "maharashtra_statewide_weekly_continuous_calendar.csv"
OUT_CSV_PATH = WATER_DIR / "water_seasonal_naive_backtest_2024h1.csv"
OUT_JSON_PATH = WATER_DIR / "water_baseline_results.json"


def run_seasonal_naive_backtest():
    df_b = pd.read_csv(BHATSA_CAL_PATH)
    df_s = pd.read_csv(STATE_CAL_PATH)

    df_b["dt"] = pd.to_datetime(df_b["expected_date"])
    df_s["dt"] = pd.to_datetime(df_s["expected_date"])

    # 1. Backtest Bhatsa Reservoir (2024-H1 vs 2023-H1)
    bhatsa_2024 = df_b[(df_b["dt"] >= "2024-01-01") & (df_b["dt"] <= "2024-06-30")].sort_values("dt").reset_index(drop=True)
    bhatsa_2023 = df_b[(df_b["dt"] >= "2023-01-01") & (df_b["dt"] <= "2023-06-30")].sort_values("dt").reset_index(drop=True)

    if len(bhatsa_2024) != 26:
        raise ValueError(f"Expected 26 weeks in 2024-H1, got {len(bhatsa_2024)}")
    if len(bhatsa_2023) != 26:
        raise ValueError(f"Expected 26 weeks in 2023-H1, got {len(bhatsa_2023)}")

    # 2. Backtest Statewide Storage (2024-H1 vs 2023-H1)
    state_2024 = df_s[(df_s["dt"] >= "2024-01-01") & (df_s["dt"] <= "2024-06-30")].sort_values("dt").reset_index(drop=True)
    state_2023 = df_s[(df_s["dt"] >= "2023-01-01") & (df_s["dt"] <= "2023-06-30")].sort_values("dt").reset_index(drop=True)

    backtest_rows = []
    for i in range(26):
        w_idx = i + 1
        d_2024 = bhatsa_2024.loc[i, "expected_date"]
        d_2023 = bhatsa_2023.loc[i, "expected_date"]

        # Bhatsa metrics (MCM)
        b_actual_mcm = bhatsa_2024.loc[i, "live_storage_mcm"]
        b_pred_mcm = bhatsa_2023.loc[i, "live_storage_mcm"]
        b_err = b_actual_mcm - b_pred_mcm
        b_abs_err = abs(b_err)
        b_ape = (b_abs_err / b_actual_mcm) * 100.0 if b_actual_mcm else None

        # Statewide metrics (storage % and normalized MCM)
        s_actual_pct = state_2024.loc[i, "storage_percent"]
        s_pred_pct = state_2023.loc[i, "storage_percent"]
        s_pct_err = s_actual_pct - s_pred_pct
        s_pct_abs_err = abs(s_pct_err)

        s_actual_mcm = state_2024.loc[i, "normalized_32res_storage_mcm"]
        s_pred_mcm = state_2023.loc[i, "normalized_32res_storage_mcm"]
        s_mcm_err = s_actual_mcm - s_pred_mcm
        s_mcm_abs_err = abs(s_mcm_err)
        s_mcm_ape = (s_mcm_abs_err / s_actual_mcm) * 100.0 if s_actual_mcm else None

        backtest_rows.append({
            "forecast_lead_weeks": w_idx,
            "forecast_target_date_2024": d_2024,
            "seasonal_naive_origin_date_2023": d_2023,
            "bhatsa_actual_storage_mcm": b_actual_mcm,
            "bhatsa_pred_seasonal_naive_mcm": b_pred_mcm,
            "bhatsa_error_mcm": round(b_err, 2),
            "bhatsa_abs_error_mcm": round(b_abs_err, 2),
            "bhatsa_ape_pct": round(b_ape, 2),
            "statewide_actual_percent": s_actual_pct,
            "statewide_pred_percent": s_pred_pct,
            "statewide_error_percent": round(s_pct_err, 2),
            "statewide_abs_error_percent": round(s_pct_abs_err, 2),
            "statewide_actual_normalized_mcm": s_actual_mcm,
            "statewide_pred_normalized_mcm": s_pred_mcm,
            "statewide_error_normalized_mcm": round(s_mcm_err, 2),
            "statewide_abs_error_normalized_mcm": round(s_mcm_abs_err, 2),
            "statewide_ape_pct": round(s_mcm_ape, 2)
        })

    df_backtest = pd.DataFrame(backtest_rows)
    df_backtest.to_csv(OUT_CSV_PATH, index=False)
    print(f"Saved 26-week backtest results to {OUT_CSV_PATH}")

    # Compute Aggregate Metrics
    # Bhatsa
    b_mae = float(df_backtest["bhatsa_abs_error_mcm"].mean())
    b_rmse = float(np.sqrt((df_backtest["bhatsa_error_mcm"] ** 2).mean()))
    b_mape = float(df_backtest["bhatsa_ape_pct"].mean())
    b_bias = float(df_backtest["bhatsa_error_mcm"].mean())

    # Statewide (Normalized 32-res MCM)
    s_mcm_mae = float(df_backtest["statewide_abs_error_normalized_mcm"].mean())
    s_mcm_rmse = float(np.sqrt((df_backtest["statewide_error_normalized_mcm"] ** 2).mean()))
    s_mcm_mape = float(df_backtest["statewide_ape_pct"].mean())
    s_mcm_bias = float(df_backtest["statewide_error_normalized_mcm"].mean())

    # Statewide (% of FRL capacity)
    s_pct_mae = float(df_backtest["statewide_abs_error_percent"].mean())
    s_pct_rmse = float(np.sqrt((df_backtest["statewide_error_percent"] ** 2).mean()))
    s_pct_bias = float(df_backtest["statewide_error_percent"].mean())

    results = {
        "model_name": "Seasonal-Naive Water Storage Baseline",
        "model_type": "SEASONAL_NAIVE_ANNUAL_52W",
        "evaluation_window": "2024-01-04 to 2024-06-27 (26 weeks / 2024-H1)",
        "forecast_origin": "2024-01-04 (Fixed Origin / 26 weeks forward)",
        "historical_training_reference": "2023-01-05 to 2023-06-29 (26 matching weeks)",
        "earlier_training_context": "2022 (41 observed weeks available)",
        "bhatsa_reservoir_metrics": {
            "reservoir_name": "Bhatsa Lake",
            "capacity_mcm": 942.1,
            "target_unit": "MCM (Million Cubic Metres)",
            "mae_mcm": round(b_mae, 2),
            "rmse_mcm": round(b_rmse, 2),
            "mape_pct": round(b_mape, 2),
            "mean_bias_mcm": round(b_bias, 2),
            "actual_storage_range_2024": f"{df_backtest['bhatsa_actual_storage_mcm'].min()} to {df_backtest['bhatsa_actual_storage_mcm'].max()} MCM",
            "pred_storage_range_2023": f"{df_backtest['bhatsa_pred_seasonal_naive_mcm'].min()} to {df_backtest['bhatsa_pred_seasonal_naive_mcm'].max()} MCM"
        },
        "maharashtra_statewide_metrics": {
            "monitored_reservoirs": 32,
            "benchmark_capacity_bcm": 19.166,
            "benchmark_capacity_mcm": 19166.0,
            "normalized_storage_mcm_metrics": {
                "mae_mcm": round(s_mcm_mae, 2),
                "rmse_mcm": round(s_mcm_rmse, 2),
                "mape_pct": round(s_mcm_mape, 2),
                "mean_bias_mcm": round(s_mcm_bias, 2)
            },
            "storage_percent_metrics": {
                "mae_percent_points": round(s_pct_mae, 2),
                "rmse_percent_points": round(s_pct_rmse, 2),
                "mean_bias_percent_points": round(s_pct_bias, 2)
            }
        },
        "verdict": {
            "data_sufficiency": "SUFFICIENT (100% weekly coverage across 2023 and 2024-H1 enables strict out-of-sample seasonal backtesting)",
            "seasonal_naive_baseline_status": "BENCHMARKED",
            "lightgbm_training_status": "HOLD (Baseline benchmarks recorded; LightGBM can be developed with weather/inflow predictors if authorized)"
        }
    }

    with open(OUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Saved baseline metrics JSON to {OUT_JSON_PATH}")

    return results, df_backtest


if __name__ == "__main__":
    results, df_backtest = run_seasonal_naive_backtest()
    print("\n=== BHATSA 26-WEEK SEASONAL-NAIVE BACKTEST RESULTS ===")
    print(f"MAE:       {results['bhatsa_reservoir_metrics']['mae_mcm']} MCM")
    print(f"RMSE:      {results['bhatsa_reservoir_metrics']['rmse_mcm']} MCM")
    print(f"MAPE:      {results['bhatsa_reservoir_metrics']['mape_pct']} %")
    print(f"Mean Bias: {results['bhatsa_reservoir_metrics']['mean_bias_mcm']} MCM")

    print("\n=== STATEWIDE 26-WEEK SEASONAL-NAIVE BACKTEST RESULTS ===")
    print(f"MAE:       {results['maharashtra_statewide_metrics']['normalized_storage_mcm_metrics']['mae_mcm']} MCM ({results['maharashtra_statewide_metrics']['storage_percent_metrics']['mae_percent_points']} % points)")
    print(f"MAPE:      {results['maharashtra_statewide_metrics']['normalized_storage_mcm_metrics']['mape_pct']} %")
    print(f"Mean Bias: {results['maharashtra_statewide_metrics']['normalized_storage_mcm_metrics']['mean_bias_mcm']} MCM")

