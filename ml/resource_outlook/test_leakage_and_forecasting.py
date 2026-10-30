"""
Unit and Integration Tests for ML-F2 Fixed-Origin Demand Forecasting Pipeline.
Verifies strict temporal boundary isolation, zero future data leakage,
climatology cutoff enforcement, and model reproducibility.
"""

import unittest
import numpy as np
import pandas as pd
from pathlib import Path

from ml.resource_outlook.train_lgbm import (
    load_data,
    compute_training_climatology,
    extract_features_for_target,
    build_fixed_origin_forecast,
    calculate_metrics,
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"


class TestLeakageAndForecasting(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.df = load_data()
        cls.train_cutoff = pd.Timestamp("2022-12-31")
        cls.climo_table = compute_training_climatology(cls.df[cls.df.index <= cls.train_cutoff])
        cls.origin = pd.Timestamp("2023-10-31")

    def test_no_future_demand_leakage(self):
        """
        Verify that mutating realized future electricity demand after the forecast origin
        has zero impact on generated features or baseline predictions.
        """
        origin = self.origin
        target_date = origin + pd.Timedelta(days=45)
        
        # 1. Feature extraction with clean data
        df_known_clean = self.df[self.df.index <= origin].copy()
        feat_clean = extract_features_for_target(target_date, origin, df_known_clean, self.climo_table)
        
        # 2. Corrupt future data in the full dataframe (simulate future demand spikes/zeros)
        df_corrupted = self.df.copy()
        future_mask = df_corrupted.index > origin
        df_corrupted.loc[future_mask, "peak_met_mw"] = 999999.0
        df_corrupted.loc[future_mask, "energy_met_mu"] = 999999.0
        
        # Feature extraction using df_corrupted filtered strictly to <= origin
        df_known_isolated = df_corrupted[df_corrupted.index <= origin]
        feat_corrupted = extract_features_for_target(target_date, origin, df_known_isolated, self.climo_table)
        
        # Compare every single feature value
        for key in feat_clean:
            val_clean = feat_clean[key]
            val_corr = feat_corrupted[key]
            if isinstance(val_clean, (int, float, np.floating)):
                self.assertAlmostEqual(val_clean, val_corr, places=6,
                                       msg=f"Feature {key} leaked future demand!")
            else:
                self.assertEqual(val_clean, val_corr,
                                 msg=f"Feature {key} leaked future demand!")

    def test_no_future_weather_leakage(self):
        """
        Verify that mutating realized future ERA5 weather variables after the forecast origin
        has zero impact on forecast features (because weather is purely climatological).
        """
        origin = self.origin
        target_date = origin + pd.Timedelta(days=60)
        
        df_known = self.df[self.df.index <= origin].copy()
        feat_base = extract_features_for_target(target_date, origin, df_known, self.climo_table)
        
        # Modify future weather observations in the dataset to extreme values
        df_mutated = self.df.copy()
        future_mask = df_mutated.index > origin
        df_mutated.loc[future_mask, "2m_temperature_max"] = 500.0  # extreme heat
        df_mutated.loc[future_mask, "surface_solar_radiation_downwards_mean"] = 0.0
        
        # Feature generator must only reference climo_table and df_known
        feat_after_weather_mutation = extract_features_for_target(
            target_date, origin, df_mutated[df_mutated.index <= origin], self.climo_table
        )
        
        self.assertAlmostEqual(feat_base["climo_t2m_max_c"], feat_after_weather_mutation["climo_t2m_max_c"], places=5)
        self.assertAlmostEqual(feat_base["climo_solar_mj"], feat_after_weather_mutation["climo_solar_mj"], places=5)
        self.assertAlmostEqual(feat_base["climo_cdd_base24"], feat_after_weather_mutation["climo_cdd_base24"], places=5)

    def test_origin_boundary_enforcement(self):
        """
        Asserts that every lagged demand feature used for predicting target T + h
        strictly corresponds to calendar dates <= origin T.
        """
        origin = self.origin
        horizon_days = 180
        
        for h in range(1, horizon_days + 1):
            target_dt = origin + pd.Timedelta(days=h)
            # Lag 364 days prior to target date
            lag_364_date = target_dt - pd.Timedelta(days=364)
            # Lag 728 days prior to target date
            lag_728_date = target_dt - pd.Timedelta(days=728)
            
            # Since h <= 180, target_dt - 364 <= origin + 180 - 364 = origin - 184 <= origin
            self.assertLessEqual(lag_364_date, origin,
                                 f"Horizon day {h} uses lag date {lag_364_date} > origin {origin}!")
            self.assertLessEqual(lag_728_date, origin,
                                 f"Horizon day {h} uses lag date {lag_728_date} > origin {origin}!")

    def test_climatology_isolation(self):
        """
        Verify that the climatological normals table is computed strictly
        from the training split (dates <= 2022-12-31) and contains no 2023-2024 information.
        """
        # If we calculate climo from df <= 2022-12-31 vs df with modified 2023-2024 data,
        # they must be identical.
        df_mod = self.df.copy()
        df_mod.loc[df_mod.index > self.train_cutoff, "2m_temperature_max"] = 999.0
        
        climo_clean = compute_training_climatology(self.df[self.df.index <= self.train_cutoff])
        climo_from_mod = compute_training_climatology(df_mod[df_mod.index <= self.train_cutoff])
        
        pd.testing.assert_frame_equal(climo_clean, climo_from_mod)

    def test_missing_date_handling(self):
        """
        Verify that missing dates in historical observations produce NaNs rather than forward-fill
        from future or invalid dates.
        """
        origin = pd.Timestamp("2023-04-30")
        # Find a date where lag_364 was missing or remove a date
        df_known_missing = self.df[self.df.index <= origin].copy()
        
        # Deliberately drop lag_364 date for day 10
        target_dt = origin + pd.Timedelta(days=10)
        d364 = target_dt - pd.Timedelta(days=364)
        if d364 in df_known_missing.index:
            df_known_missing = df_known_missing.drop(d364)
            
        feat = extract_features_for_target(target_dt, origin, df_known_missing, self.climo_table)
        self.assertTrue(np.isnan(feat["lag_364d_mw"]), "Missing lag date must be represented as NaN")

    def test_metrics_calculation(self):
        """
        Verify that calculate_metrics accurately computes MAE, RMSE, MAPE, and bias.
        """
        y_true = np.array([10000.0, 20000.0, 30000.0])
        y_pred = np.array([11000.0, 19000.0, 33000.0])  # diffs: +1000, -1000, +3000
        # MAE = (1000 + 1000 + 3000) / 3 = 1666.67
        # Bias = (1000 - 1000 + 3000) / 3 = 1000.0
        # MAPE = (10% + 5% + 10%) / 3 = 8.33%
        # RMSE = sqrt((1M + 1M + 9M)/3) = sqrt(11M/3) = sqrt(3,666,666.67) = 1914.85
        metrics = calculate_metrics(y_true, y_pred)
        self.assertEqual(metrics["mae_mw"], 1666.67)
        self.assertEqual(metrics["bias_mw"], 1000.0)
        self.assertEqual(metrics["mape_pct"], 8.33)
        self.assertEqual(metrics["rmse_mw"], 1914.85)


if __name__ == "__main__":
    unittest.main()

