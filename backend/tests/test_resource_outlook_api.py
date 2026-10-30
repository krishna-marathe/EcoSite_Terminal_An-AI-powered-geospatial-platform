"""
Integration tests for Resource Outlook API endpoints (Task 2 & Task 4).

Verifies:
1. GET /api/v1/public-facilities/{facility_id}/resource-outlook
2. GET /api/v1/resource-outlook/facility/{facility_id}
3. POST /api/v1/resource-outlook/evaluate
4. GET /api/v1/resource-outlook/regional-summary
5. Geographic service-area gating (MMR vs Non-MMR)
6. Historical backtest labeling and CURRENT FORECAST UNAVAILABLE
7. 404 for non-existent facilities
"""

import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.public_facilities import router as public_router
from backend.app.routers.resource_outlook import router as outlook_router


class ResourceOutlookApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = FastAPI()
        app.include_router(public_router, prefix="/api/v1")
        app.include_router(outlook_router, prefix="/api/v1")
        cls.client = TestClient(app)

    def test_get_resource_outlook_mmr_facility(self):
        """Verify endpoint returns correct outlook for an MMR facility (Navi Mumbai)."""
        response = self.client.get("/api/v1/public-facilities/iron-mountain-mum-1/resource-outlook")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Epistemic labeling
        self.assertEqual(data["forecast_classification"], "HISTORICAL_BACKTEST")
        self.assertEqual(data["live_status_label"], "CURRENT_FORECAST_UNAVAILABLE")

        # Power findings
        self.assertIn("power_findings", data)
        self.assertGreater(data["power_findings"]["facility_power_demand_mw"], 0)
        self.assertIn("residual_grid_requirement_mw", data["power_findings"])

        # Reservoir findings (Navi Mumbai must match Bhatsa basin)
        res = data["regional_reservoir"]
        self.assertTrue(res["service_area_match"])
        self.assertIn("Bhatsa", res["target_reservoir"])
        self.assertEqual(res["forecast_classification"], "HISTORICAL_BACKTEST")

        # Electricity findings
        elec = data["regional_electricity"]
        self.assertEqual(elec["forecast_classification"], "HISTORICAL_BACKTEST")
        self.assertEqual(elec["selected_model"], "SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS")

    def test_get_resource_outlook_non_mmr_facility(self):
        """Verify Pune facility detects basin mismatch and sets SOURCE_UNAVAILABLE."""
        response = self.client.get("/api/v1/resource-outlook/facility/stt-pune-5")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        res = data["regional_reservoir"]
        self.assertFalse(res["service_area_match"])
        self.assertEqual(res["status"], "SOURCE_UNAVAILABLE")
        self.assertEqual(res["storage_drawdown_risk"], "SOURCE_UNAVAILABLE_BASIN_MISMATCH")

    def test_evaluate_custom_parameters(self):
        """Verify POST /evaluate handles custom design calculations."""
        payload = {
            "facility_id": "custom-hyperscale",
            "facility_name": "Custom Hyperscale Hub",
            "location_district": "Thane",
            "it_capacity_mw": 20.0,
            "pue": 1.30,
            "wue": 1.20,
            "sanctioned_grid_mw": 30.0,
            "sanctioned_evidence_type": "DOCUMENTED_COMMITMENT",
            "water_allocation_kld": 600.0,
            "water_evidence_type": "DOCUMENTED_COMMITMENT",
            "renewable_ppa_pct": 50.0,
            "is_synthetic": False,
        }
        response = self.client.post("/api/v1/resource-outlook/evaluate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Demand: 20 * 1.30 = 26.0 MW
        self.assertEqual(data["power_findings"]["facility_power_demand_mw"], 26.0)
        self.assertEqual(data["power_findings"]["sanctioned_power_mw"], 30.0)
        self.assertEqual(data["power_findings"]["power_gap_mw"], 0.0)
        # Residual grid: 26.0 - (26.0 * 0.5) = 13.0 MW
        self.assertEqual(data["power_findings"]["residual_grid_requirement_mw"], 13.0)

        # Water: 20 * 24 * 1.2 = 576.0 kL/day
        self.assertEqual(data["water_findings"]["daily_water_demand_kld"], 576.0)
        self.assertEqual(data["water_findings"]["water_gap_kld"], 0.0)

        self.assertEqual(data["overall_status"], "SUPPORTED_BY_EVIDENCE")

    def test_get_regional_summary(self):
        """Verify GET /regional-summary returns versioned backtest metadata."""
        response = self.client.get("/api/v1/resource-outlook/regional-summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["status"], "HISTORICAL_BACKTEST")
        self.assertEqual(data["live_operational_forecast"], "CURRENT_FORECAST_UNAVAILABLE")
        self.assertIn("electricity", data)
        self.assertIn("reservoir", data)
        self.assertIn("80%", data["electricity"]["uncertainty"]["nominal_coverage"])

    def test_facility_not_found(self):
        """Verify 404 for unknown facility."""
        response = self.client.get("/api/v1/resource-outlook/facility/non-existent-facility-id")
        self.assertEqual(response.status_code, 404)

    def test_get_current_forecast_endpoint(self):
        """Verify GET /current-forecast returns ML-F8 live electricity forecast and Bhatsa scenarios."""
        response = self.client.get("/api/v1/resource-outlook/current-forecast")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["status"], "VALIDATED_CURRENT_OPERATIONAL_OUTLOOK")
        self.assertIn("electricity", data)
        self.assertEqual(data["electricity"]["classification"], "CURRENT_OPERATIONAL_FORECAST")
        self.assertEqual(data["electricity"]["origin_date"], "2026-10-27")
        self.assertGreater(len(data["electricity"]["points"]), 150)

        self.assertIn("reservoir", data)
        self.assertEqual(data["reservoir"]["classification"], "ILLUSTRATIVE_SCENARIO_ONLY")
        self.assertEqual(data["reservoir"]["origin_date"], "2026-10-29")
        self.assertEqual(data["reservoir"]["verified_live_storage_mcm"], 864.37)
        self.assertGreater(len(data["reservoir"]["points"]), 20)


if __name__ == "__main__":
    unittest.main()

