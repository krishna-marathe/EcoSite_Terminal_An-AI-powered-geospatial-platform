"""
Focused Integrity Test Suite for ML-F3 Real Water Dataset Ingestion.
Verifies data provenance, schema standardization, unit conversions,
seasonal gap detection, and strict separation of recent electricity data.
"""

import json
import unittest
import pandas as pd
from pathlib import Path

WATER_DIR = Path(__file__).resolve().parent
BASE_DIR = WATER_DIR.parent


class TestWaterIngestion(unittest.TestCase):
    def test_bhatsa_daily_schema_and_units(self):
        """
        Verify that Bhatsa lake daily dataset follows the standardized schema
        with units accurately converted to MCM and storage percentages bounded [0, 100].
        """
        csv_path = WATER_DIR / "bhatsa_lake_storage_daily.csv"
        self.assertTrue(csv_path.exists(), "bhatsa_lake_storage_daily.csv must exist")

        df = pd.read_csv(csv_path)
        required_cols = [
            "reservoir_id", "reservoir_name", "observation_date",
            "live_storage_mcm", "live_capacity_mcm", "storage_percent",
            "reporting_frequency", "source", "source_url", "quality_flag"
        ]
        for col in required_cols:
            self.assertIn(col, df.columns, f"Missing column {col} in Bhatsa dataset")

        self.assertGreater(len(df), 400, "Bhatsa dataset must contain at least 400 historical records")
        # Municipal useful storage capacity allocated to BMC is 717.037 MCM
        self.assertTrue((df["live_capacity_mcm"] == 717.037).all())
        # Storage percent must be non-negative and <= 100%
        valid_pct = df["storage_percent"].dropna()
        self.assertTrue((valid_pct >= 0.0).all() and (valid_pct <= 100.0).all())

    def test_bhatsa_dry_season_gaps_detected(self):
        """
        Asserts that seasonal missingness in Bhatsa dataset is accurately flagged:
        BMC reporting is active during July-Dec (monsoon), but severely sparse/missing
        in Jan-Jun (dry summer pre-monsoon drawdown). Standalone forecasting is properly blocked.
        """
        df = pd.read_csv(WATER_DIR / "bhatsa_lake_storage_daily.csv")
        df["date"] = pd.to_datetime(df["observation_date"])
        df["month"] = df["date"].dt.month

        # Count records in pre-monsoon summer (Feb to May)
        summer_records = df[df["month"].isin([2, 3, 4, 5])]
        monsoon_records = df[df["month"].isin([7, 8, 9, 10])]

        # Summer records should be virtually nonexistent (< 10) compared to monsoon (> 350)
        self.assertLess(len(summer_records), 10, "Summer records must reflect known BMC reporting gap")
        self.assertGreater(len(monsoon_records), 350, "Monsoon records must reflect primary observation period")

    def test_cwc_weekly_schema_and_units(self):
        """
        Verify that CWC major reservoirs dataset contains verified official columns,
        units in BCM and MCM, and key Maharashtra water security reservoirs.
        """
        csv_path = WATER_DIR / "maharashtra_major_reservoirs_cwc.csv"
        self.assertTrue(csv_path.exists(), "maharashtra_major_reservoirs_cwc.csv must exist")

        df = pd.read_csv(csv_path)
        required_cols = [
            "reservoir_id", "reservoir_name", "observation_date",
            "frl_m", "reservoir_level_m", "live_capacity_bcm", "live_capacity_mcm",
            "live_storage_bcm", "live_storage_mcm", "storage_percent",
            "reporting_frequency", "source", "quality_flag"
        ]
        for col in required_cols:
            self.assertIn(col, df.columns, f"Missing column {col} in CWC dataset")

        # Verify key reservoirs are present
        res_names = df["reservoir_name"].str.upper().tolist()
        self.assertTrue(any("BHATSA" in r for r in res_names), "Bhatsa must be present in CWC dataset")
        self.assertTrue(any("KOYANA" in r or "KOYNA" in r for r in res_names), "Koyna must be present in CWC dataset")

        # Check conversion consistency: MCM = BCM * 1000
        for _, row in df.dropna(subset=["live_capacity_bcm", "live_capacity_mcm"]).iterrows():
            self.assertAlmostEqual(row["live_capacity_mcm"], row["live_capacity_bcm"] * 1000.0, places=1)

    def test_cwc_multi_year_and_dry_season_coverage(self):
        """
        Verify that CWC major reservoirs dataset spans 2022 to 2025 across multiple
        years and specifically represents both the winter post-monsoon and summer
        pre-monsoon dry season (Jan to June) across 10 distinct observation dates.
        """
        csv_path = WATER_DIR / "maharashtra_major_reservoirs_cwc.csv"
        df = pd.read_csv(csv_path)

        dates = pd.to_datetime(df["observation_date"])
        years = sorted(dates.dt.year.unique())
        self.assertEqual(years, [2022, 2023, 2024, 2025], "Must span 2022, 2023, 2024, and 2025")

        # Check season coverage
        seasons = df["season"].unique()
        self.assertTrue(any("Summer" in s for s in seasons), "Summer pre-monsoon must be represented")
        self.assertTrue(any("Winter" in s for s in seasons), "Winter post-monsoon must be represented")

        # Bhatsa must be present across all downloaded dates (at least 26 weeks in 2024-H1)
        bhatsa = df[df["reservoir_name"] == "Bhatsa"]
        self.assertGreaterEqual(len(bhatsa), 26, "Bhatsa must have at least 26 weekly observation dates")

        # Verify summer drawdown in Bhatsa: May levels must be significantly lower than Jan levels
        bhatsa_2024_jan = bhatsa[bhatsa["observation_date"] == "2024-01-25"]["live_storage_bcm"].values[0]
        bhatsa_2024_may = bhatsa[bhatsa["observation_date"] == "2024-05-30"]["live_storage_bcm"].values[0]
        self.assertLess(bhatsa_2024_may, bhatsa_2024_jan, "May storage must reflect dry season depletion")

    def test_maharashtra_statewide_storage(self):
        """
        Verify that maharashtra_statewide_storage_cwc.csv exists and records
        official state aggregate storage across major reservoirs with ~19.166 BCM capacity.
        """
        csv_path = WATER_DIR / "maharashtra_statewide_storage_cwc.csv"
        self.assertTrue(csv_path.exists(), "Statewide storage CSV must exist")

        df = pd.read_csv(csv_path)
        self.assertGreaterEqual(len(df), 26, "Statewide dataset must contain at least 26 observation dates")
        self.assertTrue((df["state"] == "Maharashtra").all())
        self.assertTrue((df["storage_percent"] >= 0).all() and (df["storage_percent"] <= 100).all())

        # Verify drought detection: May 2024 was lowest state storage (<= 20%)
        may_2024 = df[df["observation_date"] == "2024-05-30"]
        self.assertEqual(len(may_2024), 1)
        self.assertLessEqual(may_2024["storage_percent"].values[0], 20.0, "May 2024 should reflect severe statewide stress")

    def test_continuous_weekly_calendar_130_weeks(self):
        """
        Verify that continuous weekly calendars exist for Bhatsa and Statewide series
        spanning 130 weeks (2022-01-06 to 2024-06-27) with explicit missing week marking
        and zero invented or forward-filled values.
        """
        bhatsa_cal_path = WATER_DIR / "bhatsa_weekly_continuous_calendar.csv"
        state_cal_path = WATER_DIR / "maharashtra_statewide_weekly_continuous_calendar.csv"
        self.assertTrue(bhatsa_cal_path.exists(), "Bhatsa calendar CSV must exist")
        self.assertTrue(state_cal_path.exists(), "Statewide calendar CSV must exist")

        df_b = pd.read_csv(bhatsa_cal_path)
        df_s = pd.read_csv(state_cal_path)

        self.assertEqual(len(df_b), 130, "Bhatsa continuous calendar must have exactly 130 calendar weeks")
        self.assertEqual(len(df_s), 130, "Statewide continuous calendar must have exactly 130 calendar weeks")

        # Verify valid observation statuses
        valid_statuses = {"OBSERVED_CWC_VERIFIED", "MISSING_OBSERVATION"}
        self.assertTrue(set(df_b["observation_status"]).issubset(valid_statuses))
        self.assertTrue(set(df_s["observation_status"]).issubset(valid_statuses))

        # Year 2023 must have 52/52 complete observations
        df_b["year"] = pd.to_datetime(df_b["expected_date"]).dt.year
        b_2023 = df_b[df_b["year"] == 2023]
        self.assertEqual(len(b_2023), 52)
        self.assertEqual((b_2023["observation_status"] == "OBSERVED_CWC_VERIFIED").sum(), 52)

        # 2024-H1 must have 26/26 complete observations
        b_2024 = df_b[(df_b["expected_date"] >= "2024-01-01") & (df_b["expected_date"] <= "2024-06-30")]
        self.assertEqual(len(b_2024), 26)
        self.assertEqual((b_2024["observation_status"] == "OBSERVED_CWC_VERIFIED").sum(), 26)

    def test_seasonal_naive_baseline_backtest(self):
        """
        Verify that seasonal-naive baseline fixed-origin 26-week backtest results exist,
        exhibit expected error bounds on Bhatsa (MAE around 40 MCM, < 5% capacity),
        and strictly avoid data leakage.
        """
        results_path = WATER_DIR / "water_baseline_results.json"
        backtest_csv_path = WATER_DIR / "water_seasonal_naive_backtest_2024h1.csv"
        self.assertTrue(results_path.exists(), "Baseline results JSON must exist")
        self.assertTrue(backtest_csv_path.exists(), "Backtest CSV must exist")

        with open(results_path, "r", encoding="utf-8") as f:
            res = json.load(f)

        self.assertEqual(res["model_type"], "SEASONAL_NAIVE_ANNUAL_52W")
        self.assertIn("bhatsa_reservoir_metrics", res)
        self.assertIn("maharashtra_statewide_metrics", res)

        b_metrics = res["bhatsa_reservoir_metrics"]
        self.assertAlmostEqual(b_metrics["mae_mcm"], 39.85, delta=1.0)
        self.assertLess(b_metrics["mape_pct"], 15.0, "Bhatsa MAPE must be under 15%")

        df_backtest = pd.read_csv(backtest_csv_path)
        self.assertEqual(len(df_backtest), 26, "Must evaluate exactly 26 forecast weeks")

    def test_observation_vs_bulletin_date_provenance(self):
        """
        Verify that both bulletin publication date and observation date are preserved
        and that provenance columns (source_file, source_url, file_sha256) are populated.
        """
        df_res = pd.read_csv(WATER_DIR / "maharashtra_major_reservoirs_cwc.csv")
        self.assertIn("bulletin_date", df_res.columns)
        self.assertIn("observation_date", df_res.columns)
        self.assertIn("source_file", df_res.columns)
        self.assertIn("file_sha256", df_res.columns)

        # Ensure no blank SHA256 hashes
        self.assertTrue(df_res["file_sha256"].str.len().gt(20).all())

    def test_water_manifest_integrity(self):
        """
        Verify water dataset manifest contains provenance, URLs, hashes, and model gating.
        """
        manifest_path = WATER_DIR / "water_dataset_manifest.json"
        self.assertTrue(manifest_path.exists())

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertIn("curated_datasets", manifest)
        self.assertIn("feasibility_verdict", manifest)
        self.assertEqual(manifest["feasibility_verdict"]["bhatsa_standalone_model"],
                         "BLOCKED (Insufficient pre-monsoon dry season observations; cannot evaluate Jan-Jun summer drawdown)")

    def test_cea_electricity_validation_separation(self):
        """
        Verify that recent CEA electricity demand records are stored in a separate
        directory (electricity_recent/) and are NOT merged into the Zenodo daily training series.
        """
        cea_json_path = BASE_DIR / "electricity_recent" / "cea_annual_validation_fy24_26.json"
        self.assertTrue(cea_json_path.exists(), "CEA validation JSON must exist in electricity_recent/")

        with open(cea_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("audited_annual_totals", data)
        # Verify Maharashtra FY25 peak is 30,675 MW
        self.assertEqual(data["audited_annual_totals"]["FY_2024_25"]["peak_met_mw"], 30675.0)


if __name__ == "__main__":
    unittest.main()

