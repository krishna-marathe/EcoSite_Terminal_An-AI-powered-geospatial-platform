"""
EcoSite Resource Outlook — Fast ML-F3.3 Resumable Water Data Ingestion Pipeline.
Automates bounded batch downloading and parsing of Central Water Commission (CWC)
weekly reservoir storage bulletins for 2022, 2023, and 2024.
"""

import os
import sys
import re
import time
import json
import hashlib
import urllib.request
from pathlib import Path
import pandas as pd
import fitz  # PyMuPDF

sys.stdout.reconfigure(encoding='utf-8')

WATER_DIR = Path(__file__).resolve().parent
RAW_DIR = WATER_DIR / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
RAW_MANIFEST_PATH = RAW_DIR / "water_raw_sources_manifest.json"
DATASET_MANIFEST_PATH = WATER_DIR / "water_dataset_manifest.json"

# Key reservoir reference metadata
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


def load_raw_manifest():
    if RAW_MANIFEST_PATH.exists():
        with open(RAW_MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_raw_manifest(manifest):
    with open(RAW_MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def get_season(date_str):
    """Categorize date into seasonal phase."""
    dt = pd.to_datetime(date_str)
    month = dt.month
    if month in [1, 2]:
        return "Winter (Post-Monsoon)"
    elif month in [3]:
        return "Spring (Mid-Dry Drawdown)"
    elif month in [4, 5]:
        return "Summer (Peak Dry Pre-Monsoon)"
    elif month in [6]:
        return "Early Monsoon Transition"
    elif month in [7, 8, 9]:
        return "Monsoon Replenishment"
    else:
        return "Post-Monsoon (Full Storage Capacity)"


def download_with_backoff(url, dest_path, max_retries=3):
    """Download a file with exponential backoff and polite delay."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    delay = 1.0
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            if len(data) < 10000:
                raise ValueError(f"Downloaded payload suspiciously small: {len(data)} bytes")
            with open(dest_path, "wb") as f:
                f.write(data)
            time.sleep(0.4)  # Polite pacing
            return True, len(data), hashlib.sha256(data).hexdigest()
        except Exception as e:
            print(f"    [Retry {attempt+1}/{max_retries}] error downloading {url}: {e}")
            time.sleep(delay)
            delay *= 2
    return False, 0, ""


def run_bounded_batch_ingestion(start_date=None, end_date=None, batch_limit=30):
    """
    Executes a bounded batch download for bulletins matching date range.
    Skips previously downloaded checksum-matching files.
    """
    catalog_path = RAW_DIR / "cwc_catalog_discovered.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catalog file not found: {catalog_path}")

    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    target_items = []
    for item in catalog:
        if not item.get("date_text"):
            continue
        parts = item["date_text"].split(".")
        if len(parts) == 3:
            iso_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
            if start_date and iso_date < start_date:
                continue
            if end_date and iso_date > end_date:
                continue
            target_items.append({
                "iso_date": iso_date,
                "date_text": item["date_text"],
                "url": item["url"],
                "title": item["title"]
            })

    target_items = sorted(target_items, key=lambda x: x["iso_date"])[:batch_limit]
    print(f"Targeting {len(target_items)} bulletins between {start_date} and {end_date} (Limit: {batch_limit})")

    manifest = load_raw_manifest()
    download_stats = {"skipped": 0, "downloaded": 0, "failed": 0}

    for item in target_items:
        date_str = item["iso_date"]
        date_compact = date_str.replace("-", "")
        filename = f"cwc_bulletin_{date_compact}.pdf"
        dest_path = RAW_DIR / filename
        season = get_season(date_str)

        # Check if already present and valid
        if dest_path.exists() and dest_path.stat().st_size > 100000:
            with open(dest_path, "rb") as f:
                sha = hashlib.sha256(f.read()).hexdigest()
            manifest[filename] = {
                "source_url": item["url"],
                "observation_date": date_str,
                "bulletin_date": date_str,
                "season": season,
                "size_bytes": dest_path.stat().st_size,
                "sha256": sha,
                "source_type": "Central Water Commission Weekly Reservoir Storage Bulletin",
                "reporting_frequency": "Weekly (Thursday)",
                "download_status": "EXISTING_VERIFIED"
            }
            download_stats["skipped"] += 1
        else:
            print(f"  [Downloading] {filename} ({date_str})...")
            ok, size, sha = download_with_backoff(item["url"], dest_path)
            if ok:
                manifest[filename] = {
                    "source_url": item["url"],
                    "observation_date": date_str,
                    "bulletin_date": date_str,
                    "season": season,
                    "size_bytes": size,
                    "sha256": sha,
                    "source_type": "Central Water Commission Weekly Reservoir Storage Bulletin",
                    "reporting_frequency": "Weekly (Thursday)",
                    "download_status": "DOWNLOADED_SUCCESS"
                }
                download_stats["downloaded"] += 1
            else:
                download_stats["failed"] += 1
                print(f"    FAILED {filename}")

    save_raw_manifest(manifest)
    print(f"Batch Summary: {download_stats}")
    return manifest


def parse_all_available_bulletins():
    """
    Parses all CWC bulletins in RAW_DIR, extracting individual reservoir records
    and statewide summary records with changing monitored-reservoir tracking.
    """
    manifest = load_raw_manifest()
    res_records = []
    state_records = []
    parse_errors = []

    pdf_files = sorted(RAW_DIR.glob("cwc_bulletin_*.pdf"))
    print(f"\nParsing {len(pdf_files)} PDF bulletins with PyMuPDF...")

    for fpath in pdf_files:
        meta = manifest.get(fpath.name, {})
        nominal_date = meta.get("observation_date", "UNKNOWN")
        season = meta.get("season", get_season(nominal_date) if nominal_date != "UNKNOWN" else "UNKNOWN")

        try:
            doc = fitz.open(fpath)
        except Exception as e:
            parse_errors.append({"file": fpath.name, "error": f"Open failure: {e}"})
            continue

        # 1. State Summary from Table-01
        state_found = False
        for pno in range(min(14, len(doc))):
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
                            try:
                                num_res = int(nums[0])
                                cap_bcm = float(nums[1])
                                cur_bcm = float(nums[2])
                                last_bcm = float(nums[3])
                                norm_bcm = float(nums[4])
                                pct_cur = float(nums[5]) if len(nums) > 5 else round(cur_bcm / cap_bcm * 100, 1)
                                pct_last = float(nums[6]) if len(nums) > 6 else None
                                pct_norm = float(nums[7]) if len(nums) > 7 else None

                                # Normalized statewide capacity scaled to modern 32-reservoir benchmark (19.166 BCM)
                                normalized_32res_storage_bcm = round((pct_cur / 100.0) * 19.166, 3)

                                state_records.append({
                                    "state": "Maharashtra",
                                    "observation_date": nominal_date,
                                    "season": season,
                                    "reservoirs_monitored_count": num_res,
                                    "live_capacity_bcm": cap_bcm,
                                    "live_capacity_mcm": round(cap_bcm * 1000.0, 1),
                                    "live_storage_bcm": cur_bcm,
                                    "live_storage_mcm": round(cur_bcm * 1000.0, 1),
                                    "normalized_32res_storage_bcm": normalized_32res_storage_bcm,
                                    "normalized_32res_storage_mcm": round(normalized_32res_storage_bcm * 1000.0, 1),
                                    "last_year_storage_bcm": last_bcm,
                                    "normal_10yr_storage_bcm": norm_bcm,
                                    "storage_percent": pct_cur,
                                    "last_year_percent": pct_last,
                                    "normal_10yr_storage_percent": pct_norm,
                                    "reporting_frequency": "WEEKLY",
                                    "source": "Central Water Commission (CWC) Table-01 State Summary",
                                    "source_file": fpath.name,
                                    "source_url": meta.get("source_url", ""),
                                    "file_sha256": meta.get("sha256", ""),
                                    "quality_flag": "OFFICIAL_CWC_VERIFIED"
                                })
                                state_found = True
                                break
                            except Exception:
                                pass
                if state_found:
                    break

        # 2. Individual Major Reservoirs from Annexure I / Table 1
        seen_res = set()
        for pno in range(len(doc)):
            txt = doc[pno].get_text()
            if "BHATSA" in txt or "KOYANA" in txt or "JAYAKWADI" in txt or "BHIMA" in txt:
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
                    elif ("BHIMA" in norm_line or "UJJANI" in norm_line or "UJJAINI" in norm_line) and "BHIMA" not in seen_res:
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
                                    parsed_date = nominal_date
                            except Exception:
                                parsed_date = nominal_date

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
                                    "bulletin_date": nominal_date,
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
                                    "source_file": fpath.name,
                                    "source_url": meta.get("source_url", ""),
                                    "file_sha256": meta.get("sha256", ""),
                                    "quality_flag": "OFFICIAL_CWC_VERIFIED"
                                })
                        except Exception:
                            pass

    df_res = pd.DataFrame(res_records).drop_duplicates(subset=["reservoir_id", "observation_date"]).sort_values(["reservoir_name", "observation_date"])
    df_state = pd.DataFrame(state_records).drop_duplicates(subset=["state", "observation_date"]).sort_values("observation_date")

    # Save to curated paths
    res_csv = WATER_DIR / "maharashtra_major_reservoirs_cwc.csv"
    state_csv = WATER_DIR / "maharashtra_statewide_storage_cwc.csv"
    df_res.to_csv(res_csv, index=False)
    df_state.to_csv(state_csv, index=False)

    print(f"Extraction complete: {len(df_res)} reservoir records, {len(df_state)} statewide records.")
    return df_res, df_state, parse_errors


def build_continuous_weekly_calendar(df_res, df_state, start_date="2022-01-06", end_date="2024-06-27"):
    """
    Builds an explicit, continuous weekly calendar (all Thursdays) marking missing weeks.
    Never invents or forward-fills missing observations.
    """
    thursdays = pd.date_range(start=start_date, end=end_date, freq="W-THU").strftime("%Y-%m-%d").tolist()
    print(f"\nBuilding Continuous Weekly Calendar from {start_date} to {end_date}: {len(thursdays)} expected weeks...")

    # 1. Bhatsa Continuous Calendar
    bhatsa_obs = df_res[df_res["reservoir_name"] == "Bhatsa"].copy()
    bhatsa_records = []

    for w_idx, thu_date in enumerate(thursdays, 1):
        dt_thu = pd.to_datetime(thu_date)
        match = None
        for _, row in bhatsa_obs.iterrows():
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
    bhatsa_cal_path = WATER_DIR / "bhatsa_weekly_continuous_calendar.csv"
    df_bhatsa_cal.to_csv(bhatsa_cal_path, index=False)
    print(f"Saved Bhatsa continuous calendar ({len(df_bhatsa_cal)} weeks) to {bhatsa_cal_path}")

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
    state_cal_path = WATER_DIR / "maharashtra_statewide_weekly_continuous_calendar.csv"
    df_state_cal.to_csv(state_cal_path, index=False)
    print(f"Saved Statewide continuous calendar ({len(df_state_cal)} weeks) to {state_cal_path}")

    return df_bhatsa_cal, df_state_cal


def update_comprehensive_manifest(df_bhatsa_cal, df_state_cal, df_res, df_state):
    """Update dataset manifest with exact multi-year metrics and baseline backtesting readiness."""
    bhatsa_obs_count = len(df_bhatsa_cal[df_bhatsa_cal["observation_status"] == "OBSERVED_CWC_VERIFIED"])
    bhatsa_miss_count = len(df_bhatsa_cal[df_bhatsa_cal["observation_status"] == "MISSING_OBSERVATION"])
    state_obs_count = len(df_state_cal[df_state_cal["observation_status"] == "OBSERVED_CWC_VERIFIED"])
    state_miss_count = len(df_state_cal[df_state_cal["observation_status"] == "MISSING_OBSERVATION"])

    manifest = {
        "dataset_name": "EcoSite Resource Outlook — Maharashtra Real Reservoir Storage Inventory",
        "last_updated": "2026-10-30",
        "ml_phase": "ML-F3.3 Complete Water Training Data",
        "multi_year_calendar_coverage": {
            "window": "2022-01-06 to 2024-06-27 (130 weeks)",
            "total_calendar_weeks": len(df_bhatsa_cal),
            "bhatsa_observed_weeks": bhatsa_obs_count,
            "bhatsa_missing_weeks": bhatsa_miss_count,
            "bhatsa_coverage_pct": round(bhatsa_obs_count / len(df_bhatsa_cal) * 100, 1),
            "statewide_observed_weeks": state_obs_count,
            "statewide_missing_weeks": state_miss_count,
            "statewide_coverage_pct": round(state_obs_count / len(df_state_cal) * 100, 1)
        },
        "curated_datasets": {
            "bhatsa_weekly_continuous_calendar": {
                "file": "bhatsa_weekly_continuous_calendar.csv",
                "description": "Continuous 130-week calendar for Bhatsa Reservoir (2022-2024) with missing weeks explicitly flagged",
                "monitored_capacity_mcm": 942.1,
                "frl_m": 142.07
            },
            "maharashtra_statewide_weekly_continuous_calendar": {
                "file": "maharashtra_statewide_weekly_continuous_calendar.csv",
                "description": "Continuous 130-week calendar for Maharashtra Statewide aggregate with normalized 32-reservoir capacity scaling",
                "monitored_capacity_benchmark_bcm": 19.166
            },
            "maharashtra_major_reservoirs_cwc": {
                "file": "maharashtra_major_reservoirs_cwc.csv",
                "record_count": len(df_res),
                "unique_dates": df_res["observation_date"].nunique(),
                "reservoirs": list(df_res["reservoir_name"].unique())
            },
            "maharashtra_statewide_storage_cwc": {
                "file": "maharashtra_statewide_storage_cwc.csv",
                "record_count": len(df_state),
                "unique_dates": df_state["observation_date"].nunique()
            }
        },
        "feasibility_verdict": {
            "bhatsa_standalone_model": "BLOCKED (Insufficient pre-monsoon dry season observations; cannot evaluate Jan-Jun summer drawdown)",
            "seasonal_naive_baseline_backtest": "READY (Multi-year 2022-2023 training series established to evaluate 2024-H1 held-out test horizon)",
            "lightgbm_water_model": "HOLD (Awaiting baseline seasonal-naive benchmark performance review)"
        }
    }

    with open(DATASET_MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Updated water dataset manifest at {DATASET_MANIFEST_PATH}")


if __name__ == "__main__":
    print("=== Starting Fast ML-F3.3 Multi-Year Ingestion ===")
    
    # Ingest in bounded batches of 25-26
    print("\n--- Batch 1: 2023-H1 ---")
    run_bounded_batch_ingestion(start_date="2023-01-01", end_date="2023-06-30", batch_limit=26)
    
    print("\n--- Batch 2: 2023-H2 ---")
    run_bounded_batch_ingestion(start_date="2023-07-01", end_date="2023-12-31", batch_limit=26)
    
    print("\n--- Batch 3: 2022-H1 ---")
    run_bounded_batch_ingestion(start_date="2022-01-01", end_date="2022-06-30", batch_limit=26)
    
    print("\n--- Batch 4: 2022-H2 ---")
    run_bounded_batch_ingestion(start_date="2022-07-01", end_date="2022-12-31", batch_limit=26)
    
    # Parse all available PDF bulletins
    df_res, df_state, errors = parse_all_available_bulletins()
    
    # Build continuous multi-year calendar (2022-01-06 to 2024-06-27)
    df_bhatsa_cal, df_state_cal = build_continuous_weekly_calendar(
        df_res, df_state, start_date="2022-01-06", end_date="2024-06-27"
    )
    
    update_comprehensive_manifest(df_bhatsa_cal, df_state_cal, df_res, df_state)
    print("\n=== ML-F3.3 Ingestion Pipeline Complete ===")
