import unittest
from fastapi.testclient import TestClient
from backend.app.main import app


class MLPredictionsApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_missing_or_zero_inputs_returns_insufficient_data(self):
        """Zero capacity and zero power returns INSUFFICIENT_INPUT_DATA, not fabricated values."""
        response = self.client.post(
            "/api/v1/ml/predict",
            json={
                "capacity_mw": 0,
                "power_demand_mw": 0,
                "water_demand_kl_day": 0,
                "location": "IN-MH",
                "months_ahead": 6,
                "model_version": "ML-F4.1",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "INSUFFICIENT_INPUT_DATA")
        self.assertEqual(data["classification"], "INSUFFICIENT_DATA")
        self.assertIsNone(data["power_demand_mw_pred"])
        self.assertIsNone(data["water_demand_kl_day_pred"])
        self.assertIsNone(data["confidence_score"])
        self.assertIn("must be strictly greater than 0", data["provenance_note"])

    def test_undisclosed_water_returns_none_never_fabricated(self):
        """When facility has no disclosed water demand (0), water_demand_kl_day_pred is null, never fabricated."""
        response = self.client.post(
            "/api/v1/ml/predict",
            json={
                "capacity_mw": 50,
                "power_demand_mw": 0,
                "water_demand_kl_day": 0,
                "location": "IN-MH",
                "months_ahead": 6,
                "model_version": "ML-F4.1",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "OK")
        self.assertEqual(data["classification"], "DETERMINISTIC_ENGINEERING_SCENARIO")
        # 50 MW capacity * 1.35 PUE = 67.5 MW power
        self.assertEqual(data["power_demand_mw_pred"], 67.5)
        # Water must be strictly None
        self.assertIsNone(data["water_demand_kl_day_pred"])
        self.assertIsNone(data["confidence_score"])
        self.assertIn("refuses to fabricate synthetic water consumption", data["provenance_note"])

    def test_model_info_returns_authentic_provenance(self):
        """Module info endpoint returns genuine ML-F2.1 / ML-F3.4 provenance, not hallucinated cards."""
        res_grid = self.client.get("/api/v1/ml/model-info/ML-F2.1")
        self.assertEqual(res_grid.status_code, 200)
        grid_data = res_grid.json()
        self.assertEqual(grid_data["scope"], "REGIONAL_MACRO_GRID_ONLY")
        self.assertEqual(grid_data["evaluated_mape_pct"], 6.76)

        res_water = self.client.get("/api/v1/ml/model-info/ML-F3.4")
        self.assertEqual(res_water.status_code, 200)
        water_data = res_water.json()
        self.assertEqual(water_data["scope"], "BASIN_RESERVOIR_STORAGE_ONLY")
        self.assertIn("Bhatsa", water_data["name"])
    def test_multimonth_horizon_differentiates_capacity_and_cooling_resources(self):
        """Planning horizons (6, 9, 12 months) return distinct phased capacity, power demand, and cooling benchmarks."""
        res_6 = self.client.post(
            "/api/v1/ml/predict",
            json={
                "capacity_mw": 24,
                "power_demand_mw": 0,
                "water_demand_kl_day": 0,
                "location": "IN-MH",
                "months_ahead": 6,
                "model_version": "ML-F4.1",
            },
        )
        data_6 = res_6.json()
        self.assertEqual(data_6["capacity_mw_pred"], 24.0)
        self.assertEqual(data_6["power_demand_mw_pred"], 32.4)
        self.assertGreater(data_6["benchmark_cooling_water_kl_day"], 0)

        res_9 = self.client.post(
            "/api/v1/ml/predict",
            json={
                "capacity_mw": 24,
                "power_demand_mw": 0,
                "water_demand_kl_day": 0,
                "location": "IN-MH",
                "months_ahead": 9,
                "model_version": "ML-F4.1",
            },
        )
        data_9 = res_9.json()
        self.assertEqual(data_9["capacity_mw_pred"], 27.0)
        self.assertEqual(data_9["power_demand_mw_pred"], 36.45)

        res_12 = self.client.post(
            "/api/v1/ml/predict",
            json={
                "capacity_mw": 24,
                "power_demand_mw": 0,
                "water_demand_kl_day": 0,
                "location": "IN-MH",
                "months_ahead": 12,
                "model_version": "ML-F4.1",
            },
        )
        data_12 = res_12.json()
        self.assertEqual(data_12["capacity_mw_pred"], 30.0)
        self.assertEqual(data_12["power_demand_mw_pred"], 40.5)

        # Differentiated across horizons
        self.assertLess(data_6["power_demand_mw_pred"], data_9["power_demand_mw_pred"])
        self.assertLess(data_9["power_demand_mw_pred"], data_12["power_demand_mw_pred"])
        self.assertIn("evaporative_hybrid_kld", data_12["benchmark_cooling_options"])
        self.assertIn("air_cooled_dry_kld", data_12["benchmark_cooling_options"])

    def test_regional_lgbm_inference_runs_booster_and_returns_provenance(self):
        """GET /api/v1/ml/regional-lgbm-inference executes live Booster inference on 20 features."""
        res = self.client.get("/api/v1/ml/regional-lgbm-inference?target_date=2026-11-20")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "OK")
        self.assertEqual(data["scope"], "MAHARASHTRA_MACRO_GRID_PEAK_MET")
        self.assertEqual(data["lead_days"], 24)
        self.assertEqual(data["horizon_status"], "OPERATIONALLY_BACKTESTED_HORIZON")
        self.assertGreater(data["predictions"]["lightgbm_predicted_peak_met_mw"], 20000)
        self.assertGreater(data["predictions"]["seasonal_naive_baseline_mw"], 20000)
        self.assertEqual(data["model_metadata"]["num_trees"], 100)
        self.assertEqual(data["model_metadata"]["num_features"], 20)
        self.assertEqual(len(data["features"]), 20)
        self.assertIn("climo_t2m_max_c", data["features"])
        self.assertIn("lag_364d_mw", data["features"])

    def test_unspecified_capacity_boundary_returns_dual_engineering_scenarios(self):
        """When capacity_boundary is power_capacity_unspecified, dual scenarios A & B are returned without false gap."""
        res = self.client.post(
            "/api/v1/ml/predict",
            json={
                "capacity_mw": 24,
                "power_demand_mw": 0,
                "water_demand_kl_day": 0,
                "location": "IN-MH",
                "months_ahead": 6,
                "model_version": "ML-F4.1",
                "capacity_boundary": "power_capacity_unspecified",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["capacity_boundary_status"], "UNSPECIFIED_BOUNDARY")
        self.assertIsNotNone(data["boundary_scenarios"])
        scen_a = data["boundary_scenarios"]["scenario_a_intake_boundary"]
        scen_b = data["boundary_scenarios"]["scenario_b_it_load_boundary"]
        self.assertEqual(scen_a["derived_it_capacity_mw"], 17.78)
        self.assertEqual(scen_a["derived_power_demand_mw"], 24.0)
        self.assertEqual(scen_b["derived_it_capacity_mw"], 24.0)
        self.assertEqual(scen_b["derived_power_demand_mw"], 32.4)
        self.assertIn("UNSPECIFIED_BOUNDARY", data["capacity_boundary_status"])

    def test_regional_lgbm_rejects_dates_before_origin(self):
        """GET /api/v1/ml/regional-lgbm-inference rejects target dates on or prior to forecast origin."""
        res = self.client.get("/api/v1/ml/regional-lgbm-inference?target_date=2026-10-25")
        self.assertEqual(res.status_code, 400)
        self.assertIn("must be strictly after forecast origin", res.json()["detail"])
