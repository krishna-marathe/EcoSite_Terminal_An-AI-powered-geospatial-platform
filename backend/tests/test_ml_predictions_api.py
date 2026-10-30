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

