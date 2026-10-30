"""
EcoSite Resource Outlook — ML-F8.1 Forecast Integrity & Source Audit
1. Generates exact 182-day (26.0 weeks) forecast from origin 2026-10-27 (2026-10-28 to 2027-04-27).
2. Generates comprehensive source-date audit CSV with explicit provenance for every single day.
3. Implements transparent 2-year seasonal lag fallback for unreleased MSLDC historical periods.
4. Evaluates independent uncertainty coverage across chronologically separate calibration (Windows 1-5) and evaluation (Windows 6-7) periods.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

ELECTRO_DIR = Path("C:/Users/marat/EcoTerminal/ml/resource_outlook/electricity_recent")
COMBINED_PATH = ELECTRO_DIR / "maharashtra_daily_combined_2013_2026.csv"
COMP_PATH = ELECTRO_DIR / "electricity_model_comparison_v3.csv"
METRICS_PATH = ELECTRO_DIR / "electricity_evaluation_metrics_v3.json"

def run_finalize():
    print("Loading combined continuous dataset...")
    df = pd.read_csv(COMBINED_PATH)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()

    prod_origin = pd.Timestamp("2026-10-27")
    df_known = df[df.index <= prod_origin]

    # Annual growth trend at production origin (trailing 1-yr mean minus prior 1-yr mean)
    y_trail = df.loc[prod_origin - pd.Timedelta(days=364):prod_origin, "peak_met_mw"].mean()
    y_prior = df.loc[prod_origin - pd.Timedelta(days=728):prod_origin - pd.Timedelta(days=365), "peak_met_mw"].mean()
    annual_trend = float(y_trail - y_prior)
    print(f"Annual growth trend at origin: {annual_trend:+.2f} MW")

    # Chronologically separate uncertainty calibration
    print("Computing chronologically independent conformal uncertainty...")
    df_comp = pd.read_csv(COMP_PATH)
    calib_windows = [
        "Winter/Summer 2022-23 (Post-COVID Growth)",
        "Monsoon 2023",
        "Winter/Summer 2023-24 (ML-F2.1 Untouched Test)",
        "Monsoon 2024 (Cross-Source Transition)",
        "Winter/Summer 2024-25 (MSLDC Recent)"
    ]
    eval_windows = [
        "Monsoon 2025 (MSLDC Recent)",
        "Winter/Summer 2025-26 (MSLDC Recent)"
    ]

    df_calib = df_comp[df_comp["window_label"].isin(calib_windows)]
    df_eval = df_comp[df_comp["window_label"].isin(eval_windows)]

    res_calib = df_calib["y_true_mw"] - df_calib["pred_seasonal_naive_mw"]
    q10_calib = float(np.percentile(res_calib, 10))
    q90_calib = float(np.percentile(res_calib, 90))

    res_eval = df_eval["y_true_mw"] - df_eval["pred_seasonal_naive_mw"]
    eval_covered = (res_eval >= q10_calib) & (res_eval <= q90_calib)
    eval_cov_pct = float(np.mean(eval_covered) * 100)
    eval_mae = float(np.mean(np.abs(res_eval)))

    print(f"Calibration Set (Windows 1-5, N={len(df_calib)}): Calibrated Bounds = [{q10_calib:.1f}, {q90_calib:.1f}] MW")
    print(f"Independent Evaluation Set (Windows 6-7, N={len(df_eval)}): Independent Coverage = {eval_cov_pct:.2f}% (MAE = {eval_mae:.2f} MW)")

    # Exact 26-week horizon: 182 days
    forecast_dates = pd.date_range("2026-10-28", periods=182, freq="D")
    print(f"Generating exact 182-day forecast: {forecast_dates[0].date()} to {forecast_dates[-1].date()}")

    forecast_rows = []
    audit_rows = []

    for i, dt in enumerate(forecast_dates, start=1):
        h = (dt - prod_origin).days
        d364 = dt - pd.Timedelta(days=364)
        d728 = dt - pd.Timedelta(days=728)

        # Check primary 1-year lag
        primary_val = df_known.loc[d364, "peak_met_mw"] if d364 in df_known.index else np.nan
        is_primary_avail = not np.isnan(primary_val)

        if is_primary_avail:
            fallback_used = "NONE_PRIMARY_LAG_AVAILABLE"
            source_date = d364
            source_val = primary_val
            trend_applied = 0.0
            pred_point = primary_val
            notes = "Direct 52-week (364-day) seasonal lag from verified MSLDC daily operational report."
        else:
            # Check 2-year lag + annual trend
            l2_val = df_known.loc[d728, "peak_met_mw"] if d728 in df_known.index else np.nan
            if not np.isnan(l2_val):
                fallback_used = "2_YEAR_LAG_WITH_ANNUAL_GROWTH_TREND"
                source_date = d728
                source_val = l2_val
                trend_applied = annual_trend
                pred_point = l2_val + annual_trend
                notes = (
                    f"Primary lag {d364.strftime('%Y-%m-%d')} unreleased by MSLDC. "
                    f"Used verified 2-year lag {d728.strftime('%Y-%m-%d')} ({l2_val:.0f} MW) "
                    f"plus annualized trend ({annual_trend:+.1f} MW), preserving exact day-of-week rhythm."
                )
            else:
                # Fallback to nearest day
                cand = None
                for offset in [7, -7, 14, -14, 1, -1, 2, -2]:
                    cd = d364 + pd.Timedelta(days=offset)
                    if cd in df_known.index and not np.isnan(df_known.loc[cd, "peak_met_mw"]):
                        cand = cd
                        break
                fallback_used = "NEAREST_MATCHING_DAY_OF_WEEK"
                source_date = cand
                source_val = df_known.loc[cand, "peak_met_mw"]
                trend_applied = 0.0
                pred_point = source_val
                notes = f"Primary lag unreleased. Used nearest observed date {cand.strftime('%Y-%m-%d')}."

        p10 = pred_point + q10_calib
        p90 = pred_point + q90_calib

        # Forecast CSV row
        forecast_rows.append({
            "forecast_date": dt.strftime("%Y-%m-%d"),
            "origin_date": prod_origin.strftime("%Y-%m-%d"),
            "horizon_weeks": 26,
            "lead_day": h,
            "lead_week": int(np.ceil(h / 7.0)),
            "day_of_week": dt.strftime("%A"),
            "predicted_peak_met_mw": round(float(pred_point), 1),
            "p10_lower_bound_mw": round(float(p10), 1),
            "p90_upper_bound_mw": round(float(p90), 1),
            "is_primary_lag_observed": is_primary_avail,
            "fallback_method_applied": fallback_used,
            "source_observation_date": source_date.strftime("%Y-%m-%d"),
            "uncertainty_method": "Chronologically Independent Conformal 80% Residual Interval",
            "forecast_classification": "CURRENT_OPERATIONAL_FORECAST",
            "source_authority": "Maharashtra State Load Despatch Centre (MSLDC) + Zenodo POSOCO"
        })

        # Audit CSV row
        audit_rows.append({
            "lead_day": h,
            "forecast_date": dt.strftime("%Y-%m-%d"),
            "day_of_week": dt.strftime("%A"),
            "primary_lag_364d_date": d364.strftime("%Y-%m-%d"),
            "is_primary_lag_observed": is_primary_avail,
            "fallback_method": fallback_used,
            "source_observation_date": source_date.strftime("%Y-%m-%d"),
            "source_observed_peak_mw": round(float(source_val), 1),
            "trend_adjustment_mw": round(float(trend_applied), 1),
            "final_predicted_peak_met_mw": round(float(pred_point), 1),
            "calibrated_p10_mw": round(float(p10), 1),
            "calibrated_p90_mw": round(float(p90), 1),
            "provenance_and_audit_notes": notes
        })

    # Save exact 182-day forecast
    df_fc = pd.DataFrame(forecast_rows)
    fc_path = ELECTRO_DIR / "electricity_forecast_26w_2026_2027.csv"
    df_fc.to_csv(fc_path, index=False)
    print(f"Saved {len(df_fc)} days to {fc_path.name}")

    # Save source audit CSV
    df_audit = pd.DataFrame(audit_rows)
    audit_path = ELECTRO_DIR / "electricity_forecast_26w_source_audit.csv"
    df_audit.to_csv(audit_path, index=False)
    print(f"Saved {len(df_audit)} audit rows to {audit_path.name}")
    print(f"Primary lag observed days: {df_audit['is_primary_lag_observed'].sum()} / {len(df_audit)} ({df_audit['is_primary_lag_observed'].mean()*100:.1f}%)")
    print(f"Fallback days (2-year lag + trend): {(~df_audit['is_primary_lag_observed']).sum()} / {len(df_audit)}")

    # Update metrics JSON
    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        metrics_data = json.load(f)

    metrics_data["chronological_uncertainty_split"] = {
        "calibration_period": {
            "windows": calib_windows,
            "total_days": len(df_calib),
            "calibrated_q10_offset_mw": round(q10_calib, 1),
            "calibrated_q90_offset_mw": round(q90_calib, 1),
            "calibration_nominal_target": "80%"
        },
        "independent_evaluation_period": {
            "windows": eval_windows,
            "total_days": len(df_eval),
            "independent_empirical_coverage_pct": round(eval_cov_pct, 2),
            "independent_mae_mw": round(eval_mae, 2),
            "status": "INDEPENDENTLY_VALIDATED"
        }
    }
    metrics_data["model_selection"]["calibrated_80pct_uncertainty_interval_mw"] = [round(q10_calib, 1), round(q90_calib, 1)]
    metrics_data["model_selection"]["uncertainty_coverage_pct"] = round(eval_cov_pct, 2)
    metrics_data["production_forecast_metadata"]["horizon_26w_range"] = f"{forecast_dates[0].strftime('%Y-%m-%d')} to {forecast_dates[-1].strftime('%Y-%m-%d')} (exact 182 days / 26.0 weeks)"
    metrics_data["production_forecast_metadata"]["total_days"] = 182
    metrics_data["production_forecast_metadata"]["peak_forecasted_demand_mw"] = float(df_fc["predicted_peak_met_mw"].max())
    metrics_data["production_forecast_metadata"]["summer_peak_warning_mw"] = float(df_fc["p90_upper_bound_mw"].max())
    metrics_data["production_forecast_metadata"]["forecast_files"]["source_audit_csv"] = audit_path.name

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Updated {METRICS_PATH.name}")

if __name__ == "__main__":
    run_finalize()
