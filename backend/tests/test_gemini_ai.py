"""Unit tests for Gemini AI Assistant Service and Router."""
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.schemas.ai_assist import (
    AiServiceStatus,
    FacilityAiAssistResponse,
)
from app.services.gemini_ai import (
    _build_facility_prompt,
    _deterministic_baseline_insights,
    generate_facility_ai_insights,
    get_service_status,
)


class TestGeminiAiService(unittest.TestCase):
    def setUp(self):
        self.sample_facility = {
            "id": "iron-mountain-mum-1",
            "name": "MUM-1",
            "operator": "Iron Mountain Data Centers",
            "ownershipCategory": "private",
            "facilityType": "colocation",
            "stateCode": "IN-MH",
            "state": "Maharashtra",
            "city": "Navi Mumbai",
            "locality": "Navi Mumbai",
            "publicCoordinates": [73.0169, 19.0330],
            "capacityDisclosures": [
                {"value": 2.3, "unit": "MW", "capacityType": "total_power", "scope": "facility"}
            ],
            "verification": {
                "status": "public_operator_confirmed",
                "verifiedAt": "2026-10-29",
                "expiresAt": "2027-01-27",
            },
        }

    def test_service_status(self):
        status = get_service_status()
        self.assertIsInstance(status, AiServiceStatus)
        self.assertEqual(status.primaryModel, "gemini-3.8-flash")
        self.assertTrue(len(status.fallbackModels) > 0)

    def test_build_facility_prompt_contains_statutory_and_site_data(self):
        prompt = _build_facility_prompt(
            facility=self.sample_facility,
            environmental_data={"heat.temperature_max": {"value": 34.5}},
            substation={"name": "Airoli 220kV Substation", "voltageKv": 220, "distanceKm": 1.8},
            population={"densityPerKm2": 6500, "densityBand": "HIGH"},
            focus_area="Water Conservation",
            custom_prompt="How does CGWA groundwater NOC apply here?",
            inspection_mode="MEITY_OVERSIGHT",
        )
        self.assertIn("MUM-1", prompt)
        self.assertIn("Navi Mumbai", prompt)
        self.assertIn("2.3 MW", prompt)
        self.assertIn("Maharashtra Pollution Control Board (MPCB)", prompt)
        self.assertIn("Airoli 220kV Substation", prompt)
        self.assertIn("6,500 persons/km2", prompt)
        self.assertIn("SPECIAL AUDIT FOCUS: Water Conservation", prompt)
        self.assertIn("How does CGWA groundwater NOC apply here?", prompt)

    def test_deterministic_baseline_insights(self):
        res = _deterministic_baseline_insights(
            facility=self.sample_facility,
            substation={"name": "Airoli 220kV Substation", "voltageKv": 220, "distanceKm": 1.8},
            population={"densityPerKm2": 6500, "densityBand": "HIGH"},
        )
        self.assertIn("criticalityTier", res)
        self.assertIn("interventions", res)
        self.assertGreater(len(res["interventions"]), 2)
        self.assertIn("complianceChecklist", res)
        self.assertIn("Maharashtra Pollution Control Board", res["stateRegulatoryBody"])
        self.assertIn("ministryAssessment", res)
        self.assertIn("departmentPerspective", res["ministryAssessment"])

    def test_generate_facility_ai_insights_fallback(self):
        # Force invalid model and empty key to test fallback
        with patch("app.services.gemini_ai.get_gemini_api_key", return_value=""):
            result = generate_facility_ai_insights(self.sample_facility)
            self.assertIsInstance(result, FacilityAiAssistResponse)
            self.assertEqual(result.status, "fallback_deterministic")
            self.assertIn("Deterministic Engineering Engine", result.modelUsed)
            self.assertGreaterEqual(len(result.interventions), 3)
            self.assertGreaterEqual(len(result.complianceChecklist), 3)
            # Verify 1km and 5km population metrics and pleasant buffer alert
            pop = result.infrastructureTelemetry.population
            self.assertEqual(pop.population1km, 6200)
            self.assertEqual(pop.population5km, 118000)
            self.assertIn("WorldPop", pop.dataSource)
            self.assertIn("pleasant", pop.bufferAlert.lower())

    @patch("app.services.gemini_ai._call_gemini_endpoint")
    def test_generate_facility_ai_insights_live_gemini(self, mock_call):
        mock_call.return_value = {
            "criticalityTier": "TIER_1_ELEVATED",
            "criticalityLabel": "Elevated Criticality",
            "vulnerabilityOverview": "Campus is within high-density urban cluster.",
            "stateRegulatoryBody": "Maharashtra Pollution Control Board (MPCB)",
            "stateDiscom": "MSEDCL",
            "interventions": [
                {
                    "id": "gem-01",
                    "title": "Acoustic Attenuation for DG Sets",
                    "category": "TERRAIN_CIVIL",
                    "priority": "HIGH",
                    "timeframe": "1 - 3 Months",
                    "responsibleStakeholder": "Civil Works Lead",
                    "expectedBenefit": "Sound level <= 55 dBA",
                    "statutoryBasis": "Noise Rules 2000",
                    "rationale": "High residential density nearby.",
                }
            ],
            "complianceChecklist": [
                {
                    "item": "Air Consent Renewal",
                    "authority": "MPCB",
                    "mandatory": True,
                    "notes": "Annual verification",
                }
            ],
            "disclaimer": "Screening only.",
        }

        with patch("app.services.gemini_ai.get_gemini_api_key", return_value="fake-key"):
            result = generate_facility_ai_insights(self.sample_facility)
            self.assertEqual(result.status, "live_ai")
            self.assertIn("gemini-3.8-flash", result.modelUsed)
            self.assertEqual(result.criticalityTier, "TIER_1_ELEVATED")
            self.assertEqual(len(result.interventions), 1)
            self.assertEqual(result.interventions[0].id, "gem-01")


if __name__ == "__main__":
    unittest.main()
