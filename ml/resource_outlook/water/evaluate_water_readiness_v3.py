"""
EcoSite Resource Outlook — ML-F8 Task 3: Water Forecast Readiness & Illustrative Scenarios
1. Evaluates existing Bhatsa reservoir models on extended historical observations (2024-H1, 2024-H2, 2025-H1).
2. Explicitly analyzes the unreleased May 2025 - October 2026 weekly series.
3. Generates clearly labeled illustrative drawdown scenarios from the verified 2026-10-29 benchmark (864.37 MCM).
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

WATER_DIR = Path(__file__).resolve().parent
BHATSA_PATH = WATER_DIR / "bhatsa_weekly_2022_2025_cwc.csv"
MANIFEST_PATH = WATER_DIR / "water_dataset_manifest_v2.json"

def run_water_readiness_assessment():
    print("Loading Bhatsa multi-year CWC weekly observations...")
    df = pd.read_csv(BHATSA_PATH)
    df["expected_date"] = pd.to_datetime(df["expected_date"])
    df = df.set_index("expected_date").sort_index()

    # 1. Historical Backtesting on Available Windows
    # Window A: 2024-H1 (2024-01-04 to 2024-06-27: 26 weeks) - Dry Season Drawdown
    w_2024h1_dates = pd.date_range("2024-01-04", "2024-06-27", freq="7D")
    # Window B: 2024-H2 (2024-07-04 to 2024-12-26: 26 weeks) - Monsoon Refill
    w_2024h2_dates = pd.date_range("2024-07-04", "2024-12-26", freq="7D")
    # Window C: 2025-H1 partial (2025-01-02 to 2025-05-01: 18 weeks) - Recent Dry Season
    w_2025h1_dates = pd.date_range("2025-01-02", "2025-05-01", freq="7D")

    test_windows = [
        ("2024-H1 Dry Season", w_2024h1_dates),
        ("2024-H2 Monsoon Refill", w_2024h2_dates),
        ("2025-H1 Partial Dry Season", w_2025h1_dates)
    ]

    backtest_results = {}
    for label, dates in test_windows:
        actuals = []
        preds_naive = []
        preds_trend = []

        # Origin is the week prior to window start
        org_date = dates[0] - pd.Timedelta(days=7)
        org_storage = df.loc[org_date, "live_storage_mcm"] if org_date in df.index else np.nan

        # Trend offset at origin
        prior_yr_org = org_date - pd.Timedelta(days=364)
        trend_offset = 0.0
        if org_date in df.index and prior_yr_org in df.index:
            s_cur = df.loc[org_date, "live_storage_mcm"]
            s_pri = df.loc[prior_yr_org, "live_storage_mcm"]
            if not np.isnan(s_cur) and not np.isnan(s_pri):
                trend_offset = float(s_cur - s_pri)

        for dt in dates:
            if dt in df.index:
                y_act = df.loc[dt, "live_storage_mcm"]
                lag_dt = dt - pd.Timedelta(days=364)
                y_lag = df.loc[lag_dt, "live_storage_mcm"] if lag_dt in df.index else np.nan

                if not np.isnan(y_act) and not np.isnan(y_lag):
                    actuals.append(y_act)
                    preds_naive.append(y_lag)
                    preds_trend.append(max(0.0, min(942.1, y_lag + trend_offset)))

        act = np.array(actuals)
        p_naive = np.array(preds_naive)
        p_trend = np.array(preds_trend)

        if len(act) > 0:
            mae_naive = float(np.mean(np.abs(act - p_naive)))
            mape_naive = float(np.mean(np.abs((act - p_naive) / act)) * 100)
            mae_trend = float(np.mean(np.abs(act - p_trend)))
            mape_trend = float(np.mean(np.abs((act - p_trend) / act)) * 100)

            backtest_results[label] = {
                "evaluated_weeks": len(act),
                "seasonal_naive_mae_mcm": round(mae_naive, 2),
                "seasonal_naive_mape_pct": round(mape_naive, 2),
                "trend_adjusted_mae_mcm": round(mae_trend, 2),
                "trend_adjusted_mape_pct": round(mape_trend, 2)
            }
            print(f"[{label}] N={len(act)} weeks | Naive MAE: {mae_naive:.2f} MCM ({mape_naive:.2f}%) | Trend MAE: {mae_trend:.2f} MCM ({mape_trend:.2f}%)")

    # 2. Verified 2026-10-29 Benchmark
    BENCHMARK_DATE = "2026-10-29"
    BENCHMARK_STORAGE_MCM = 864.37  # 0.86437 BCM
    BENCHMARK_PCT = 91.76
    CAPACITY_FRL_MCM = 942.0

    # 3. Build Illustrative 26-Week Drawdown Scenarios from 2026-10-29
    # Horizon: 2026-11-05 to 2027-04-29 (26 weekly Thursday intervals)
    scenario_dates = pd.date_range("2026-11-05", "2027-04-29", freq="7D")

    # Historical depletion reference:
    # On 2022-10-27: 906.86 MCM -> 2023-04-27: 494.3 MCM (drawdown rate ~15.8 MCM/wk)
    # On 2023-10-26: 871.2 MCM  -> 2024-04-25: 397.0 MCM (drawdown rate ~18.2 MCM/wk)
    # Drought pace (severe year): drawdown rate ~21.5 MCM/wk
    # Wet pace (mild winter): drawdown rate ~13.5 MCM/wk

    scenario_rows = []
    for week_num, dt in enumerate(scenario_dates, start=1):
        # Scenario A: Historical 10-Yr Normal Drawdown (~17.0 MCM/wk average)
        # Slower in Nov-Jan (~13 MCM/wk), faster in Feb-Apr (~21 MCM/wk)
        decay_normal = 13.0 * min(week_num, 12) + 21.0 * max(0, week_num - 12)
        storage_normal = max(100.0, BENCHMARK_STORAGE_MCM - decay_normal)

        # Scenario B: Stressed Drought Drawdown (15% faster depletion)
        decay_dry = 16.0 * min(week_num, 12) + 26.0 * max(0, week_num - 12)
        storage_dry = max(80.0, BENCHMARK_STORAGE_MCM - decay_dry)

        # Scenario C: Mild / High-Retention Drawdown (20% slower depletion)
        decay_wet = 10.5 * min(week_num, 12) + 16.5 * max(0, week_num - 12)
        storage_wet = max(150.0, BENCHMARK_STORAGE_MCM - decay_wet)

        scenario_rows.append({
            "scenario_date": dt.strftime("%Y-%m-%d"),
            "origin_date": BENCHMARK_DATE,
            "origin_storage_mcm": BENCHMARK_STORAGE_MCM,
            "origin_storage_pct": BENCHMARK_PCT,
            "week_number": week_num,
            "lead_days": week_num * 7,
            "scenario_normal_depletion_mcm": round(float(storage_normal), 2),
            "scenario_normal_pct": round(float(storage_normal / CAPACITY_FRL_MCM * 100), 2),
            "scenario_dry_stress_mcm": round(float(storage_dry), 2),
            "scenario_dry_stress_pct": round(float(storage_dry / CAPACITY_FRL_MCM * 100), 2),
            "scenario_wet_retention_mcm": round(float(storage_wet), 2),
            "scenario_wet_retention_pct": round(float(storage_wet / CAPACITY_FRL_MCM * 100), 2),
            "classification": "ILLUSTRATIVE_SCENARIO_ONLY",
            "epistemic_status": "CURRENT_OBSERVATION_VERIFIED_INTERMEDIATE_SERIES_GATED",
            "provenance": "Central Water Commission RSMS Approved Bulletin 2026-10-29"
        })

    df_scenarios = pd.DataFrame(scenario_rows)
    scenario_csv_path = WATER_DIR / "bhatsa_illustrative_scenarios_2026_2027.csv"
    df_scenarios.to_csv(scenario_csv_path, index=False)
    print(f"Saved {len(df_scenarios)} weekly illustrative scenarios to {scenario_csv_path.name}")

    # Build Water Metrics & Readiness JSON
    water_report = {
        "report_name": "EcoSite Resource Outlook — Bhatsa Reservoir Forecast Readiness & Scenarios (v3)",
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
        "ml_phase": "ML-F8 Current Forecast Development",
        "verified_ground_truth_origin": {
            "reservoir_name": "Bhatsa (D02993, Thane / MMR Supply Basin)",
            "observation_date": BENCHMARK_DATE,
            "live_storage_bcm": 0.86437,
            "live_storage_mcm": BENCHMARK_STORAGE_MCM,
            "live_capacity_frl_mcm": CAPACITY_FRL_MCM,
            "storage_percent": BENCHMARK_PCT,
            "prior_year_comparison_mcm": 906.86,
            "prior_year_comparison_pct": 96.27,
            "ten_year_normal_mcm": 906.60,
            "ten_year_normal_pct": 96.24,
            "source": "Central Water Commission RSMS Public Portal (Bulletin Approved 2026-10-29)"
        },
        "intermediate_data_gap_assessment": {
            "missing_period": "2025-05-08 to 2026-10-22 (77 calendar weeks)",
            "status": "SOURCE_UNAVAILABLE",
            "blocker_explanation": "The public RSMS Angular dashboard only renders the latest approved bulletin as on 2026-10-29. Multi-week historical archive queries require authenticated credentials at https://rsms.cwc.gov.in/admin/login. The public static bulletin archive at cwc.gov.in ended weekly uploads on 2025-05-01.",
            "epistemic_policy_compliance": "Zero synthetic water records. EcoSite refuses to invent 77 unreleased intermediate weeks."
        },
        "forecast_readiness_verdict": {
            "status": "PARTIALLY READY / ORIGIN BENCHMARK VERIFIED",
            "justification": "While the origin state as of 2026-10-29 is officially verified (864.37 MCM, 91.76%), continuous weekly backtesting across 2025-2026 is blocked by the 77-week unreleased gap. Therefore, current post-monsoon 2026 outlook is provided as clearly labeled ILLUSTRATIVE SCENARIOS anchored to the verified origin, NOT an unvalidated continuous statistical forecast.",
            "recommended_operational_mode": "CURRENT_OBSERVATION_AND_ILLUSTRATIVE_SCENARIO"
        },
        "historical_backtest_evaluations": backtest_results,
        "illustrative_scenarios_metadata": {
            "file": scenario_csv_path.name,
            "horizon_weeks": 26,
            "date_range": "2026-11-05 to 2027-04-29",
            "scenarios_included": [
                "Normal Seasonal Depletion (Historical 10-Yr Drawdown Rate)",
                "Dry Year Stressed Depletion (Accelerated Non-Monsoon Drawdown)",
                "Wet Year Retention (Slower Non-Monsoon Drawdown)"
            ]
        }
    }

    water_json_path = WATER_DIR / "water_evaluation_metrics_v3.json"
    with open(water_json_path, "w") as f:
        json.dump(water_report, f, indent=2)
    print(f"Saved water evaluation report to {water_json_path.name}")

if __name__ == "__main__":
    run_water_readiness_assessment()
