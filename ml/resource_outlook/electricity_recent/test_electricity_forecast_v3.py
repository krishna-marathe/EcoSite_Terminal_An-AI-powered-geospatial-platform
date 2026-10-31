"""
Unit test suite for ML-F8 Electricity Forecasting & Scenarios Artifacts
"""

import json
import unittest
import pandas as pd
from pathlib import Path

ELECTRO_DIR = Path(__file__).resolve().parent
WATER_DIR = ELECTRO_DIR.parent / "water"

class TestElectricityForecastV3(unittest.TestCase):
    def test_data_quality_report(self):
        qr_path = ELECTRO_DIR / "data_quality_report.json"
        self.assertTrue(qr_path.exists())
        with open(qr_path, "r", encoding="utf-8") as f:
            qr = json.load(f)
        self.assertEqual(qr["quality_metrics"]["calendar_days"], 912)
        self.assertEqual(qr["quality_metrics"]["observed_days"], 886)
        self.assertEqual(qr["quality_metrics"]["missing_days"], 26)
        self.assertEqual(len(qr["missing_dates_diagnostics"]["records"]), 26)
        self.assertIn("0 MW", qr["boundary_overlap_verification"]["peak_demand_met_difference"])

    def test_evaluation_metrics_v3(self):
        em_path = ELECTRO_DIR / "electricity_evaluation_metrics_v3.json"
        self.assertTrue(em_path.exists())
        with open(em_path, "r", encoding="utf-8") as f:
            em = json.load(f)
        self.assertEqual(len(em["cross_validation_windows"]), 7)
        self.assertIn("SEASONAL_NAIVE", em["model_selection"]["selected_model"])
        self.assertLess(em["model_selection"]["average_cross_validation_mape_pct"], 8.0)
        self.assertGreater(em["model_selection"]["uncertainty_coverage_pct"], 75.0)

    def test_forecast_26w_csv(self):
        fc_path = ELECTRO_DIR / "electricity_forecast_26w_2026_2027.csv"
        self.assertTrue(fc_path.exists())
        df = pd.read_csv(fc_path)
        self.assertEqual(len(df), 182)
        self.assertEqual(df["forecast_date"].min(), "2026-10-28")
        self.assertEqual(df["forecast_date"].max(), "2027-04-27")
        self.assertEqual(df["predicted_peak_met_mw"].isnull().sum(), 0)
        self.assertTrue((df["p90_upper_bound_mw"] >= df["predicted_peak_met_mw"]).all())
        self.assertTrue((df["predicted_peak_met_mw"] >= df["p10_lower_bound_mw"]).all())

        # Test source audit CSV
        audit_path = ELECTRO_DIR / "electricity_forecast_26w_source_audit.csv"
        self.assertTrue(audit_path.exists())
        df_audit = pd.read_csv(audit_path)
        self.assertEqual(len(df_audit), 182)
        self.assertEqual(df_audit["is_primary_lag_observed"].sum(), 165)
        self.assertEqual((~df_audit["is_primary_lag_observed"]).sum(), 17)

    def test_water_scenarios(self):
        sc_path = WATER_DIR / "bhatsa_illustrative_scenarios_2026_2027.csv"
        self.assertTrue(sc_path.exists())
        df = pd.read_csv(sc_path)
        self.assertEqual(len(df), 26)
        self.assertEqual(df["origin_storage_mcm"].iloc[0], 864.37)
        self.assertEqual(df["origin_storage_pct"].iloc[0], 91.76)
        # Verify dry scenario storage < normal < wet
        last_row = df.iloc[-1]
        self.assertLess(last_row["scenario_dry_stress_mcm"], last_row["scenario_normal_depletion_mcm"])
        self.assertLess(last_row["scenario_normal_depletion_mcm"], last_row["scenario_wet_retention_mcm"])

if __name__ == "__main__":
    unittest.main()
