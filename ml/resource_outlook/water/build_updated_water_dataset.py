"""
EcoSite Resource Outlook — ML-F7 Updated Water Dataset Pipeline.
Parses all 163 downloaded official CWC weekly bulletins (2022-01-06 to 2025-05-01),
extracting Bhatsa, Koyna, Jayakwadi, Ujjani, and Maharashtra statewide storage.
Creates versioned updated datasets while preserving historical benchmarks.
"""

import os
import sys
import json
from pathlib import Path
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

WATER_DIR = Path(__file__).resolve().parent
RAW_DIR = WATER_DIR / "raw"

# Import parser from batch_ingest_cwc
sys.path.append(str(WATER_DIR))
from batch_ingest_cwc import parse_all_available_bulletins, RAW_MANIFEST_PATH


def build_versioned_continuous_calendars(df_res, df_state, start_date="2022-01-06", end_date="2025-05-01"):
    """
    Builds continuous weekly calendars across 2022-01-06 through 2025-05-01.
    Explicitly marks missing weeks without inventing data.
    """
    thursdays = pd.date_range(start=start_date, end=end_date, freq="W-THU").strftime("%Y-%m-%d").tolist()
    total_weeks = len(thursdays)
    print(f"\nBuilding continuous calendars for {total_weeks} weekly steps ({start_date} to {end_date})...")

    # 1. Bhatsa Continuous Calendar
    df_bhatsa = df_res[df_res["reservoir_name"] == "Bhatsa"].copy()
    bhatsa_records = []

    for w_idx, thu_date in enumerate(thursdays, 1):
        dt_thu = pd.to_datetime(thu_date)
        match = None
        for _, row in df_bhatsa.iterrows():
            obs_dt = pd.to_datetime(row["observation_date"])
            if abs((obs_dt - dt_thu).days) <= 2:
                match = row
                break

        if match is not None:
            bhatsa_records.append({
                "calendar_week_number": w_idx,
                "expected_date": thu_date,
                "observation_date": match["observation_date"],
                "bulletin_date": match["bulletin_date"],
                "reservoir_name": "Bhatsa",
                "reservoir_level_m": match["reservoir_level_m"],
                "live_capacity_mcm": match["live_capacity_mcm"],
                "live_storage_mcm": match["live_storage_mcm"],
                "storage_percent": match["storage_percent"],
                "10yr_normal_percent": match["normal_10yr_storage_percent"],
                "observation_status": "OBSERVED_CWC_VERIFIED",
                "source_file": match["source_file"]
            })
        else:
            bhatsa_records.append({
                "calendar_week_number": w_idx,
                "expected_date": thu_date,
                "observation_date": None,
                "bulletin_date": None,
                "reservoir_name": "Bhatsa",
                "reservoir_level_m": None,
                "live_capacity_mcm": 942.1,
                "live_storage_mcm": None,
                "storage_percent": None,
                "10yr_normal_percent": None,
                "observation_status": "MISSING_OBSERVATION",
                "source_file": None
            })

    df_bhatsa_cal = pd.DataFrame(bhatsa_records)
    bhatsa_cal_path = WATER_DIR / "bhatsa_weekly_2022_2025_cwc.csv"
    df_bhatsa_cal.to_csv(bhatsa_cal_path, index=False)
    print(f"Saved Bhatsa versioned calendar ({len(df_bhatsa_cal)} weeks) to {bhatsa_cal_path.name}")

    # 2. Statewide Continuous Calendar
    state_records = []
    for w_idx, thu_date in enumerate(thursdays, 1):
        dt_thu = pd.to_datetime(thu_date)
        match = None
        for _, row in df_state.iterrows():
            obs_dt = pd.to_datetime(row["observation_date"])
            if abs((obs_dt - dt_thu).days) <= 2:
                match = row
                break

        if match is not None:
            state_records.append({
                "calendar_week_number": w_idx,
                "expected_date": thu_date,
                "observation_date": match["observation_date"],
                "state": "Maharashtra",
                "monitored_reservoirs_count": match["reservoirs_monitored_count"],
                "live_capacity_bcm": match["live_capacity_bcm"],
                "live_storage_bcm": match["live_storage_bcm"],
                "live_storage_mcm": match["live_storage_mcm"],
                "normalized_32res_storage_bcm": match["normalized_32res_storage_bcm"],
                "normalized_32res_storage_mcm": match["normalized_32res_storage_mcm"],
                "storage_percent": match["storage_percent"],
                "10yr_normal_percent": match["normal_10yr_storage_percent"],
                "observation_status": "OBSERVED_CWC_VERIFIED",
                "source_file": match["source_file"]
            })
        else:
            state_records.append({
                "calendar_week_number": w_idx,
                "expected_date": thu_date,
                "observation_date": None,
                "state": "Maharashtra",
                "monitored_reservoirs_count": 32,
                "live_capacity_bcm": 19.166,
                "live_storage_bcm": None,
                "live_storage_mcm": None,
                "normalized_32res_storage_bcm": None,
                "normalized_32res_storage_mcm": None,
                "storage_percent": None,
                "10yr_normal_percent": None,
                "observation_status": "MISSING_OBSERVATION",
                "source_file": None
            })

    df_state_cal = pd.DataFrame(state_records)
    state_cal_path = WATER_DIR / "maharashtra_statewide_weekly_2022_2025_cwc.csv"
    df_state_cal.to_csv(state_cal_path, index=False)
    print(f"Saved Statewide versioned calendar ({len(df_state_cal)} weeks) to {state_cal_path.name}")

    # Also save full major reservoirs table
    major_path = WATER_DIR / "maharashtra_major_reservoirs_cwc_v2.csv"
    df_res.to_csv(major_path, index=False)
    print(f"Saved Major Reservoirs records ({len(df_res)} records) to {major_path.name}")

    return df_bhatsa_cal, df_state_cal


def generate_v2_manifest(df_bhatsa_cal, df_state_cal, df_res, df_state):
    bhatsa_obs = len(df_bhatsa_cal[df_bhatsa_cal["observation_status"] == "OBSERVED_CWC_VERIFIED"])
    bhatsa_miss = len(df_bhatsa_cal[df_bhatsa_cal["observation_status"] == "MISSING_OBSERVATION"])
    state_obs = len(df_state_cal[df_state_cal["observation_status"] == "OBSERVED_CWC_VERIFIED"])
    state_miss = len(df_state_cal[df_state_cal["observation_status"] == "MISSING_OBSERVATION"])

    manifest_v2 = {
        "dataset_name": "EcoSite Resource Outlook — Maharashtra Real Reservoir Storage Inventory (v2)",
        "last_updated": "2026-10-30",
        "ml_phase": "ML-F7 Real Data Integration",
        "provenance": {
            "source_authority": "Central Water Commission (CWC), Ministry of Jal Shakti, Government of India",
            "source_portal": "https://cwc.gov.in/reservoir-level-storage-bulletin",
            "reporting_frequency": "Weekly (Thursday bulletins)",
            "total_official_pdf_bulletins_acquired": 163,
            "raw_storage_directory": "ml/resource_outlook/water/raw/"
        },
        "coverage_metrics": {
            "start_date": "2022-01-06",
            "latest_available_cwc_bulletin_date": "2025-05-01",
            "total_calendar_weeks": len(df_bhatsa_cal),
            "bhatsa_reservoir": {
                "monitored_capacity_mcm": 942.1,
                "observed_weeks": bhatsa_obs,
                "missing_weeks": bhatsa_miss,
                "completeness_pct": round(bhatsa_obs / len(df_bhatsa_cal) * 100, 1),
                "latest_observed_storage_mcm": float(df_bhatsa_cal[df_bhatsa_cal['observation_status'] == 'OBSERVED_CWC_VERIFIED'].iloc[-1]['live_storage_mcm']),
                "latest_observation_date": str(df_bhatsa_cal[df_bhatsa_cal['observation_status'] == 'OBSERVED_CWC_VERIFIED'].iloc[-1]['observation_date'])
            },
            "maharashtra_statewide": {
                "observed_weeks": state_obs,
                "missing_weeks": state_miss,
                "completeness_pct": round(state_obs / len(df_state_cal) * 100, 1),
                "benchmark_capacity_bcm": 19.166,
                "latest_observed_storage_bcm": float(df_state_cal[df_state_cal['observation_status'] == 'OBSERVED_CWC_VERIFIED'].iloc[-1]['live_storage_bcm']),
                "latest_observation_date": str(df_state_cal[df_state_cal['observation_status'] == 'OBSERVED_CWC_VERIFIED'].iloc[-1]['observation_date'])
            }
        },
        "curated_datasets": {
            "versioned_bhatsa_calendar": {
                "file": "bhatsa_weekly_2022_2025_cwc.csv",
                "weeks": len(df_bhatsa_cal),
                "description": "Continuous weekly time-series from 2022-01-06 to 2025-05-01 with verified CWC observations."
            },
            "versioned_statewide_calendar": {
                "file": "maharashtra_statewide_weekly_2022_2025_cwc.csv",
                "weeks": len(df_state_cal),
                "description": "Continuous weekly time-series for Maharashtra statewide storage scaled to 32 monitored reservoirs."
            },
            "versioned_major_reservoirs": {
                "file": "maharashtra_major_reservoirs_cwc_v2.csv",
                "total_records": len(df_res),
                "reservoirs_included": list(df_res["reservoir_name"].unique())
            },
            "preserved_historical_benchmarks": {
                "bhatsa_benchmark_file": "bhatsa_weekly_continuous_calendar.csv",
                "statewide_benchmark_file": "maharashtra_statewide_weekly_continuous_calendar.csv",
                "water_model_comparison_2024h1": "water_model_comparison_2024h1.csv"
            }
        },
        "forecast_readiness_assessment": {
            "forecast_origin_feasible": "2025-05-01",
            "historical_evaluation_readiness": "READY (Multi-year training 2022-2024 available; held-out test windows 2024-H1 and 2024-H2/2025-H1 available)",
            "live_october_2026_forecasting": "BLOCKED (CWC public PDF bulletin repository concludes at May 1, 2025. Data between May 2025 and October 2026 is unreleased in public bulletin archive. Per EcoSite rules, missing records cannot be fabricated.)"
        }
    }

    manifest_path = WATER_DIR / "water_dataset_manifest_v2.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_v2, f, indent=2)
    print(f"Saved Versioned Water Manifest to {manifest_path.name}")
    return manifest_v2


if __name__ == "__main__":
    print("=== Running ML-F7 Updated Water Ingestion Pipeline ===")
    df_res, df_state, errors = parse_all_available_bulletins()
    print(f"Parsed {len(df_res)} reservoir observations and {len(df_state)} statewide observations.")
    if errors:
        print(f"Encountered {len(errors)} parse warnings.")

    df_bhatsa_cal, df_state_cal = build_versioned_continuous_calendars(
        df_res, df_state, start_date="2022-01-06", end_date="2025-05-01"
    )
    manifest = generate_v2_manifest(df_bhatsa_cal, df_state_cal, df_res, df_state)
    print("\nSummary Metrics:")
    print(f"Bhatsa observed weeks: {manifest['coverage_metrics']['bhatsa_reservoir']['observed_weeks']}/{manifest['coverage_metrics']['total_calendar_weeks']}")
    print(f"Statewide observed weeks: {manifest['coverage_metrics']['maharashtra_statewide']['observed_weeks']}/{manifest['coverage_metrics']['total_calendar_weeks']}")
    print("=== Completed Water Ingestion ===")
