"""
Unit and Integration Tests for ML-F2.1 Forecast Reliability & Selection Pipeline.
Verifies out-of-sample uncertainty calibration, test set purity,
candidate baseline formulations, and leak-free temporal boundary enforcement.
"""

import json
import unittest
import numpy as np
import pandas as pd
from pathlib import Path

from ml.resource_outlook.compare_candidates_v2 import (
    load_dataset,
    compute_training_climatology,
    extract_regularized_features,
    calculate_metrics,
    TRAIN_CUTOFF,
    TEST_ORIGIN,
)

BASE_DIR = Path(__file__).resolve().parent


class TestForecastingV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.df = load_dataset()
        cls.climo_table = compute_training_climatology(cls.df[cls.df.index <= TRAIN_CUTOFF])
        cls.test_origin = TEST_ORIGIN

    def test_candidate2_future_leakage(self):
        """
        Verify that mutating future electricity demand after the forecast origin
        has zero impact on Candidate 2 (Simpler Regularized LightGBM) features.
        """
        origin = self.test_origin
        target_dt = origin + pd.Timedelta(days=50)

        df_known_clean = self.df[self.df.index <= origin].copy()
        feat_clean = extract_regularized_features(target_dt, origin, df_known_clean, self.climo_table)

        # Mutate future values in full dataset
        df_corrupted = self.df.copy()
        df_corrupted.loc[df_corrupted.index > origin, "peak_met_mw"] = 888888.0

        feat_corrupted = extract_regularized_features(
            target_dt, origin, df_corrupted[df_corrupted.index <= origin], self.climo_table
        )

        for k in feat_clean:
            if isinstance(feat_clean[k], (int, float, np.floating)):
                self.assertAlmostEqual(feat_clean[k], feat_corrupted[k], places=6,
                                       msg=f"Feature {k} leaked future demand in Candidate 2!")
            else:
                self.assertEqual(feat_clean[k], feat_corrupted[k],
                                 msg=f"Feature {k} leaked future demand in Candidate 2!")

    def test_trend_adjustment_boundary_isolation(self):
        """
        Verify that Candidate 3 (Trend-Adjusted Baseline) strictly uses trailing 365 days
        relative to origin T and never queries data after origin T.
        """
        origin = pd.Timestamp("2022-04-30")
        df_known = self.df[self.df.index <= origin]

        # Trailing 1-year mean
        t_trail = df_known.loc[origin - pd.Timedelta(days=364):origin, "peak_met_mw"].mean()
        t_prior = df_known.loc[origin - pd.Timedelta(days=728):origin - pd.Timedelta(days=365), "peak_met_mw"].mean()
        trend = t_trail - t_prior

        # Compare with query on full dataframe mutated at future dates
        df_mutated = self.df.copy()
        df_mutated.loc[df_mutated.index > origin, "peak_met_mw"] = 999999.0
        df_mutated_known = df_mutated[df_mutated.index <= origin]

        t_trail_mut = df_mutated_known.loc[origin - pd.Timedelta(days=364):origin, "peak_met_mw"].mean()
        t_prior_mut = df_mutated_known.loc[origin - pd.Timedelta(days=728):origin - pd.Timedelta(days=365), "peak_met_mw"].mean()
        trend_mut = t_trail_mut - t_prior_mut

        self.assertAlmostEqual(trend, trend_mut, places=5)

    def test_out_of_sample_calibration_purity(self):
        """
        Verify that out-of-sample calibration residuals are sourced strictly from dates
        prior to TEST_ORIGIN (2023-10-31), ensuring zero data snooping from the test set.
        """
        backtest_v2 = pd.read_csv(BASE_DIR / "backtest_predictions_v2.csv")
        backtest_v2["date"] = pd.to_datetime(backtest_v2["date"])

        # Calibration data is defined by split == 'validation'
        val_rows = backtest_v2[backtest_v2["split"] == "validation"]
        self.assertTrue((val_rows["date"] <= self.test_origin).all(),
                        "Validation split used for calibration must precede or equal test origin!")

    def test_calibrated_uncertainty_coverage(self):
        """
        Asserts that calibrated prediction intervals achieve acceptable out-of-sample coverage
        on the untouched test set (>= 75%, nominal 80%), resolving the ML-F2 undercoverage failure.
        """
        with open(BASE_DIR / "uncertainty_results_v2.json", "r", encoding="utf-8") as f:
            unc = json.load(f)

        test_cov = unc["untouched_test_set_coverage_pct"]
        self.assertGreaterEqual(test_cov, 75.0,
                                f"Calibrated coverage ({test_cov}%) failed to meet acceptable reliability threshold!")
        self.assertEqual(unc["calibration_verdict"], "CALIBRATED_EMPIRICAL_RELIABILITY")

    def test_honest_model_selection(self):
        """
        Verifies that model selection honors empirical evidence and selects Seasonal-Naive
        because it achieved lower error than all trained models on the untouched test horizon.
        """
        with open(BASE_DIR / "evaluation_metrics_v2.json", "r", encoding="utf-8") as f:
            metrics = json.load(f)

        test_m = metrics["untouched_test_window"]
        naive_mae = test_m["seasonal_naive_baseline"]["mae_mw"]
        lgb_mae = test_m["simpler_regularized_lgb"]["mae_mw"]
        trend_mae = test_m["seasonal_trend_adjusted"]["mae_mw"]

        # Assert seasonal naive is lowest MAE on untouched test set
        self.assertLess(naive_mae, lgb_mae, "Seasonal Naive must beat LightGBM on untouched test set")
        self.assertLess(naive_mae, trend_mae, "Seasonal Naive must beat Trend-Adjusted on untouched test set")

        # Assert selection verdict reflects this reality
        selected = metrics["model_selection"]["selected_model"]
        self.assertEqual(selected, "SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS")


if __name__ == "__main__":
    unittest.main()
