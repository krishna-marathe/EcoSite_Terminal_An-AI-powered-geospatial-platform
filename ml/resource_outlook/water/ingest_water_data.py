"""
EcoSite Resource Outlook — Water Ingestion Pipeline (ML-F3.1)
Extracts dated reservoir storage observations for Maharashtra from:
1. BMC Hydraulic Engineer Daily Reports Mirror (Bhatsa municipal daily)
2. Official Central Water Commission (CWC) Weekly Storage Bulletins (Bhatsa, Koyna, Jayakwadi, Ujjani)
3. CWC Table-01 Maharashtra State Aggregate Storage
"""

import os
import re
import json
import hashlib
from pathlib import Path
import pandas as pd
import fitz  # PyMuPDF

WATER_DIR = Path(__file__).resolve().parent
RAW_DIR = WATER_DIR / "raw"

# Metadata for key Maharashtra reservoirs
RES_META = {
    'BHATSA': {
        'id': 'CWC_BHATSA',
        'name': 'Bhatsa',
        'basin': 'West Flowing Rivers from Tapi to Tadri',
        'district': 'Thane',
        'design_frl_m': 142.07,
        'design_cap_bcm': 0.942,
        'hydel_mw': 15.0
    },
    'KOYANA': {
        'id': 'CWC_KOYNA',
        'name': 'Koyna',
        'basin': 'Krishna',
        'district': 'Satara',
        'design_frl_m': 657.90,
        'design_cap_bcm': 2.652,
        'hydel_mw': 1920.0
    },
    'JAYAKWADI': {
        'id': 'CWC_JAYAKWADI',
        'name': 'Jayakwadi (Paithan)',
        'basin': 'Godavari',
        'district': 'Chhatrapati Sambhajinagar',
        'design_frl_m': 463.91,
        'design_cap_bcm': 2.171,
        'hydel_mw': 0.0
    },
    'BHIMA': {
        'id': 'CWC_UJJANI',
        'name': 'Bhima (Ujjani)',
        'basin': 'Krishna',
        'district': 'Solapur',
        'design_frl_m': 496.83,
        'design_cap_bcm': 1.517,
        'hydel_mw': 12.0
    }
}


def ingest_bmc_bhatsa():
    """Ingest BMC Bhatsa lake daily records."""
    json_path = RAW_DIR / "bombay7_timeseries.json"
    if not json_path.exists():
        print(f"File not found: {json_path}")
        return None

    with open(json_path, "r", encoding="utf-8") as f:
        ts_data = json.load(f)

    bhatsa_ts = next(l for l in ts_data["lakes"] if l["key"] == "bhatsa")
    b_pts = bhatsa_ts["points"]

    records = []
    for p in b_pts:
        dt = p["date"]
        useful_ml = p.get("useful_ml")
        pct = p.get("pct")
        rain_today = p.get("today_rain_mm")
        rain_total = p.get("total_rain_mm")

        # 1 ML = 1,000 m3 = 0.001 MCM
        live_storage_mcm = round(useful_ml * 0.001, 3) if useful_ml is not None else None
        live_cap_mcm = round(bhatsa_ts["capacity_ml"] * 0.001, 3)  # 717.037 MCM

        records.append({
            "reservoir_id": "BHATSA_BMC",
            "reservoir_name": "Bhatsa Lake (BMC Municipal Allocation)",
            "observation_date": dt,
            "live_storage_mcm": live_storage_mcm,
            "live_capacity_mcm": live_cap_mcm,
            "storage_percent": pct,
            "today_rain_mm": rain_today,
            "total_rain_mm": rain_total,
            "reporting_frequency": "DAILY_MONSOON_SPARSE",
            "source": "Brihanmumbai Municipal Corporation (BMC) Hydraulic Engineer Daily Reports",
            "source_url": "https://gist.githubusercontent.com/saketkc/c5aa25e6d4626821ecaf6339004e48a5/raw/timeseries.json",
            "quality_flag": "VALID_OBSERVED" if pct is not None else "MISSING"
        })

    df = pd.DataFrame(records).sort_values("observation_date").drop_duplicates("observation_date")
    out_csv = WATER_DIR / "bhatsa_lake_storage_daily.csv"
    df.to_csv(out_csv, index=False)
    print(f"Saved {len(df)} BMC Bhatsa daily records to {out_csv}")
    return df


def ingest_cwc_bulletins():
    """Ingest reservoir-level and state-level storage from official CWC weekly bulletins."""
    manifest_path = RAW_DIR / "water_raw_sources_manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        raw_manifest = json.load(f)

    res_records = []
    state_records = []

    for fname, meta in sorted(raw_manifest.items()):
        if not fname.startswith("cwc_bulletin_"):
            continue
        fpath = RAW_DIR / fname
        obs_date = meta["observation_date"]
        season = meta["season"]
        doc = fitz.open(fpath)

        seen_res = set()

        # 1. Extract State-level summary from Table-01
        for pno in range(min(12, len(doc))):
            txt = doc[pno].get_text()
            if "TABLE-01" in txt.upper() or "STATUS OF CURRENT STORAGE" in txt.upper():
                lines = [l.strip() for l in txt.split("\n") if l.strip()]
                for i, line in enumerate(lines):
                    if line.upper() in ["2 MAH.", "MAH.", "MAHARASHTRA", "2 MAHARASHTRA"] or ("MAH" in line.upper() and any(c.isdigit() for c in line)):
                        nums = []
                        for j in range(i + 1, min(len(lines), i + 15)):
                            w = lines[j]
                            if re.match(r"^-?[0-9]+(\.[0-9]+)?$", w):
                                nums.append(w)
                            elif any(reg in w.upper() for reg in ["GOA", "GUJARAT", "SUB-TOTAL", "WESTERN"]):
                                break
                        if len(nums) >= 5:
                            num_res = int(nums[0])
                            cap_bcm = float(nums[1])
                            cur_bcm = float(nums[2])
                            last_bcm = float(nums[3])
                            norm_bcm = float(nums[4])
                            pct_cur = float(nums[5]) if len(nums) > 5 else round(cur_bcm / cap_bcm * 100, 1)
                            pct_last = float(nums[6]) if len(nums) > 6 else None
                            pct_norm = float(nums[7]) if len(nums) > 7 else None

                            state_records.append({
                                "state": "Maharashtra",
                                "observation_date": obs_date,
                                "season": season,
                                "reservoirs_monitored_count": num_res,
                                "live_capacity_bcm": cap_bcm,
                                "live_capacity_mcm": round(cap_bcm * 1000.0, 1),
                                "live_storage_bcm": cur_bcm,
                                "live_storage_mcm": round(cur_bcm * 1000.0, 1),
                                "last_year_storage_bcm": last_bcm,
                                "normal_10yr_storage_bcm": norm_bcm,
                                "storage_percent": pct_cur,
                                "last_year_percent": pct_last,
                                "normal_10yr_storage_percent": pct_norm,
                                "reporting_frequency": "WEEKLY",
                                "source": "Central Water Commission (CWC) Table-01 State Summary",
                                "source_file": fname,
                                "source_url": meta["source_url"],
                                "file_sha256": meta["sha256"],
                                "quality_flag": "OFFICIAL_CWC_VERIFIED"
                            })
                            break
                if state_records and state_records[-1]["observation_date"] == obs_date:
                    break

        # 2. Extract Individual Major Reservoirs from Annexure I / Table 1
        for pno in range(len(doc)):
            txt = doc[pno].get_text()
            if "BHATSA" in txt or "KOYANA" in txt or "JAYAKWADI" in txt:
                lines = [l.strip() for l in txt.split("\n") if l.strip()]
                for i, line in enumerate(lines):
                    norm_line = line.upper().replace(" ", "").replace("*", "").replace("$", "")

                    matched_key = None
                    if "BHATSA" in norm_line and "BHATSA" not in seen_res:
                        matched_key = "BHATSA"
                    elif "KOYANA" in norm_line and "KOYANA" not in seen_res:
                        matched_key = "KOYANA"
                    elif "JAYAKWADI" in norm_line and "JAYAKWADI" not in seen_res:
                        matched_key = "JAYAKWADI"
                    elif ("BHIMA" in norm_line or "UJJANI" in norm_line) and "BHIMA" not in seen_res:
                        matched_key = "BHIMA"

                    if matched_key:
                        window = lines[i + 1: min(len(lines), i + 12)]
                        tokens = []
                        for w in window:
                            for part in w.split():
                                tokens.append(part)

                        try:
                            frl_m = float(tokens[0])
                            level_m = float(tokens[1])
                            cap_bcm = float(tokens[2])
                            storage_bcm = float(tokens[3])

                            raw_date = tokens[4]
                            try:
                                if len(raw_date.split("-")[-1]) == 2:
                                    parsed_date = pd.to_datetime(raw_date, format="%d-%m-%y").strftime("%Y-%m-%d")
                                elif len(raw_date.split("-")[-1]) == 4:
                                    parsed_date = pd.to_datetime(raw_date, format="%d-%m-%Y").strftime("%Y-%m-%d")
                                elif len(raw_date.split(".")[-1]) == 4:
                                    parsed_date = pd.to_datetime(raw_date, format="%d.%m.%Y").strftime("%Y-%m-%d")
                                else:
                                    parsed_date = obs_date
                            except Exception:
                                parsed_date = obs_date

                            pct_curr = float(tokens[5]) if len(tokens) > 5 else round(storage_bcm / cap_bcm * 100, 2)
                            pct_last = float(tokens[6]) if len(tokens) > 6 and re.match(r"^-?[0-9.]+$", tokens[6]) else None
                            pct_norm = float(tokens[7]) if len(tokens) > 7 and re.match(r"^-?[0-9.]+$", tokens[7]) else None

                            meta_info = RES_META[matched_key]
                            if abs(frl_m - meta_info["design_frl_m"]) < 5.0 and abs(cap_bcm - meta_info["design_cap_bcm"]) < 0.1:
                                seen_res.add(matched_key)
                                res_records.append({
                                    "reservoir_id": meta_info["id"],
                                    "reservoir_name": meta_info["name"],
                                    "basin": meta_info["basin"],
                                    "district": meta_info["district"],
                                    "observation_date": parsed_date,
                                    "season": season,
                                    "frl_m": frl_m,
                                    "reservoir_level_m": level_m,
                                    "live_capacity_bcm": cap_bcm,
                                    "live_capacity_mcm": round(cap_bcm * 1000.0, 1),
                                    "live_storage_bcm": storage_bcm,
                                    "live_storage_mcm": round(storage_bcm * 1000.0, 1),
                                    "storage_percent": pct_curr,
                                    "last_year_percent": pct_last,
                                    "normal_10yr_storage_percent": pct_norm,
                                    "hydel_mw": meta_info["hydel_mw"],
                                    "reporting_frequency": "WEEKLY",
                                    "source": "Central Water Commission (CWC) Weekly Reservoir Storage Bulletin",
                                    "source_file": fname,
                                    "source_url": meta["source_url"],
                                    "file_sha256": meta["sha256"],
                                    "quality_flag": "OFFICIAL_CWC_VERIFIED"
                                })
                        except Exception:
                            pass

    # Save reservoir-level dataset
    df_res = pd.DataFrame(res_records).drop_duplicates(subset=["reservoir_id", "observation_date"]).sort_values(["reservoir_name", "observation_date"])
    res_csv = WATER_DIR / "maharashtra_major_reservoirs_cwc.csv"
    df_res.to_csv(res_csv, index=False)
    print(f"Saved {len(df_res)} CWC reservoir records to {res_csv}")

    # Save state-level dataset
    df_state = pd.DataFrame(state_records).drop_duplicates(subset=["state", "observation_date"]).sort_values("observation_date")
    state_csv = WATER_DIR / "maharashtra_statewide_storage_cwc.csv"
    df_state.to_csv(state_csv, index=False)
    print(f"Saved {len(df_state)} CWC Maharashtra statewide records to {state_csv}")

    return df_res, df_state


def update_manifest(df_bhatsa, df_res, df_state):
    """Write comprehensive water dataset manifest."""
    manifest = {
        "dataset_name": "EcoSite Resource Outlook — Maharashtra Real Reservoir Storage Inventory",
        "last_updated": "2026-10-30",
        "curated_datasets": {
            "bhatsa_lake_storage_daily": {
                "file": "bhatsa_lake_storage_daily.csv",
                "record_count": len(df_bhatsa) if df_bhatsa is not None else 0,
                "date_range": f"{df_bhatsa['observation_date'].min()} to {df_bhatsa['observation_date'].max()}" if df_bhatsa is not None else "N/A",
                "source_authority": "Brihanmumbai Municipal Corporation (BMC) Hydraulic Engineer Department",
                "source_url": "https://gist.githubusercontent.com/saketkc/c5aa25e6d4626821ecaf6339004e48a5/raw/timeseries.json",
                "reporting_frequency": "Daily (Monsoon-concentrated sparse reports)",
                "monitored_capacity_mcm": 717.037,
                "capacity_definition": "BMC Municipal Allocation useful storage (total FRL live capacity is 942.1 MCM)",
                "service_area": "Mumbai Metropolitan Region (MMR), Thane, and Navi Mumbai data centre corridors",
                "continuity_evaluation": "INCOMPLETE (Severe gaps in Jan-Jun dry season; 433 dates over 2020-2026, <10 in dry months)",
                "training_feasibility": "BLOCKED for standalone seasonal forecasting due to pre-monsoon dry season gaps"
            },
            "maharashtra_major_reservoirs_cwc": {
                "file": "maharashtra_major_reservoirs_cwc.csv",
                "record_count": len(df_res),
                "unique_observation_dates": df_res["observation_date"].nunique(),
                "years_covered": sorted(pd.to_datetime(df_res["observation_date"]).dt.year.unique().tolist()),
                "reservoirs_monitored": {
                    "Bhatsa": {"capacity_bcm": 0.942, "capacity_mcm": 942.1, "corridor": "MMR / Thane / Navi Mumbai Data Centre Belt"},
                    "Koyna": {"capacity_bcm": 2.652, "capacity_mcm": 2652.0, "corridor": "Western Maharashtra / Hydroelectric Grid"},
                    "Jayakwadi (Paithan)": {"capacity_bcm": 2.171, "capacity_mcm": 2171.0, "corridor": "Marathwada / Chhatrapati Sambhajinagar"},
                    "Bhima (Ujjani)": {"capacity_bcm": 1.517, "capacity_mcm": 1517.0, "corridor": "Pune / Solapur Industrial Belt"}
                },
                "seasonal_coverage": {
                    "winter_post_monsoon_jan": len(df_res[df_res["season"].str.contains("Winter", na=False)]),
                    "spring_mid_dry_drawdown_mar": len(df_res[df_res["season"].str.contains("Spring", na=False)]),
                    "summer_peak_dry_apr_may": len(df_res[df_res["season"].str.contains("Summer", na=False)]),
                    "post_monsoon_full_storage_oct": len(df_res[df_res["season"].str.contains("Post-Monsoon \(Full", na=False)])
                },
                "source_authority": "Central Water Commission (CWC), Ministry of Jal Shakti, Government of India",
                "source_bulletins_url": "https://cwc.gov.in/reservoir-level-storage-bulletin",
                "reporting_frequency": "Weekly (Every Thursday afternoon, year-round 52 weeks)",
                "parameters": ["FRL (m)", "Current Level (m)", "Live Capacity (BCM/MCM)", "Current Live Storage (BCM/MCM)", "Current %", "Last Year %", "10-Yr Normal %"],
                "continuity_evaluation": "CONTINUOUS (Official CWC weekly bulletins archived continuously >20 years)",
                "training_feasibility": "FEASIBLE for multi-year seasonal benchmarks once full weekly batch is extracted"
            },
            "maharashtra_statewide_storage_cwc": {
                "file": "maharashtra_statewide_storage_cwc.csv",
                "record_count": len(df_state),
                "unique_observation_dates": df_state["observation_date"].nunique(),
                "years_covered": sorted(pd.to_datetime(df_state["observation_date"]).dt.year.unique().tolist()),
                "total_monitored_reservoirs": 32,
                "total_live_capacity_bcm": 19.166,
                "total_live_capacity_mcm": 19166.0,
                "source_authority": "Central Water Commission (CWC) Table-01 State Summary",
                "source_bulletins_url": "https://cwc.gov.in/reservoir-level-storage-bulletin",
                "reporting_frequency": "Weekly (Every Thursday)",
                "continuity_evaluation": "CONTINUOUS (Official statewide aggregate across 32 major reservoirs)",
                "training_feasibility": "FEASIBLE for state-level water stress forecasting"
            }
        },
        "feasibility_verdict": {
            "bhatsa_standalone_model": "BLOCKED (Insufficient pre-monsoon dry season observations; cannot evaluate Jan-Jun summer drawdown)",
            "cwc_water_model_training": "BLOCKED (Bounded sample of 10 seasonal bulletins verifies high data fidelity, but continuous 52-week time-series across multiple years is required before training LightGBM)"
        }
    }

    manifest_out = WATER_DIR / "water_dataset_manifest.json"
    with open(manifest_out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved updated manifest to {manifest_out}")


if __name__ == "__main__":
    df_bhatsa = ingest_bmc_bhatsa()
    df_res, df_state = ingest_cwc_bulletins()
    update_manifest(df_bhatsa, df_res, df_state)
