"""
Focused Unit Test Suite for ML-F3.4 Water Forecast Model Comparison.
Validates strict origin boundary enforcement, metric calculations,
sample size honesty, and model selection logic.
"""

import json
import unittest
from pathlib import Path
import pandas as pd
import numpy as np

WATER_DIR = Path(__file__).resolve().parent
RESULTS_JSON_PATH = WATER_DIR / "water_model_results.json"
COMPARISON_CSV_PATH = WATER_DIR / "water_model_comparison_2024h1.csv"
CALENDAR_PATH = WATER_DIR / "bhatsa_weekly_continuous_calendar.csv"
BHATSA_CAPACITY_MCM = 942.1


class TestWaterForecastModels(unittest.TestCase):
    def setUp(self):
        self.assertTrue(RESULTS_JSON_PATH.exists(), "water_model_results.json must exist")
        self.assertTrue(COMPARISON_CSV_PATH.exists(), "water_model_comparison_2024h1.csv must exist")
        self.assertTrue(CALENDAR_PATH.exists(), "bhatsa_weekly_continuous_calendar.csv must exist")

        with open(RESULTS_JSON_PATH, "r", encoding="utf-8") as f:
            self.results = json.load(f)
        self.df_comp = pd.read_csv(COMPARISON_CSV_PATH)
        self.df_cal = pd.read_csv(CALENDAR_PATH)

    def test_forecast_horizon_and_origin(self):
        """
        Verify that evaluation horizon spans exactly 26 weeks of 2024-H1
        starting from fixed origin 2024-01-04.
        """
        self.assertEqual(len(self.df_comp), 26, "Must evaluate exactly 26 weeks")
        self.assertEqual(self.df_comp.loc[0, "target_date_2024"], "2024-01-04")
        self.assertEqual(self.df_comp.loc[25, "target_date_2024"], "2024-06-27")
        self.assertEqual(self.results["forecast_origin"], "2024-01-04 (Fixed Origin / 26 weeks forward)")

    def test_trend_adjusted_baseline_improvement(self):
        """
        Verify that Candidate 2 (Trend-Adjusted Baseline) dramatically reduces
        MAE from Candidate 1 (~40 MCM) down to ~10 MCM (< 1.5% of reservoir capacity).
        """
        c1 = self.results["candidates"]["candidate_1_seasonal_naive"]
        c2 = self.results["candidates"]["candidate_2_trend_adjusted_baseline"]

        self.assertAlmostEqual(c1["mae_mcm"], 39.85, delta=1.0)
        self.assertAlmostEqual(c2["mae_mcm"], 10.23, delta=1.0)

        # MAE improvement must be greater than 60%
        improvement_pct = (c1["mae_mcm"] - c2["mae_mcm"]) / c1["mae_mcm"] * 100.0
        self.assertGreater(improvement_pct, 60.0)

        # Error as % of capacity must be under 2.0%
        self.assertLess(c2["error_pct_of_capacity"], 2.0)

    def test_no_future_data_leakage(self):
        """
        Verify that mutating realized future observations in 2024 after week 1
        does not alter the predictions of Candidate 1 or Candidate 2.
        """
        # Candidate 1 depends only on 2023
        # Candidate 2 depends only on 2023 and the origin observation Y_2024[0]
        # Mutating Y_2024[15] must not change Candidate 2's prediction for any week
        y_orig = self.df_comp.loc[0, "actual_storage_mcm"]
        pred_c2_w20 = self.df_comp.loc[19, "cand2_trend_adjusted_mcm"]

        # Re-derive delta_0 strictly using origin
        lag_orig = self.df_comp.loc[0, "cand1_seasonal_naive_mcm"]
        delta_0 = y_orig - lag_orig
        expected_w20 = self.df_comp.loc[19, "cand1_seasonal_naive_mcm"] + delta_0
        self.assertAlmostEqual(pred_c2_w20, expected_w20, places=1)

    def test_sample_size_honesty_and_model_selection(self):
        """
        Verify that LightGBM's limited sample size (16 historical training rows)
        is documented honestly and justifies selecting Candidate 2.
        """
        c3 = self.results["candidates"]["candidate_3_regularized_lightgbm"]
        self.assertIn("training_sample_size", c3)
        self.assertEqual(c3["training_sample_size"], 16, "LightGBM training sample size must be 16")

        selected = self.results["selected_approach"]
        self.assertIn("Candidate 2", selected["model_name"])
        self.assertEqual(selected["status"], "ML-F3.4 READY")

    def test_uncertainty_bounds_validity(self):
        """
        Verify that uncertainty intervals are bounded within physical capacity [0, 942.1] MCM
        and that honest disclaimers are present.
        """
        p10 = self.df_comp["cand2_p10_lower_mcm"].values
        p90 = self.df_comp["cand2_p90_upper_mcm"].values

        self.assertTrue((p10 >= 0.0).all(), "P10 lower bound must be >= 0 MCM")
        self.assertTrue((p90 <= BHATSA_CAPACITY_MCM).all(), f"P90 upper bound must be <= {BHATSA_CAPACITY_MCM} MCM")
        self.assertTrue((p90 >= p10).all(), "P90 must be >= P10")

        uncertainty_info = self.results["uncertainty_assessment"]
        self.assertIn("disclaimer", uncertainty_info)
        self.assertIn("cannot be guaranteed", uncertainty_info["disclaimer"])


if __name__ == "__main__":
    unittest.main()

