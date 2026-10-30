import unittest
from datetime import date
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers import public_facilities as public_router


FIXED_TODAY = date(2026, 10, 29)
ORIGINAL_SERVICE = public_router._service


def fixed_service():
    return ORIGINAL_SERVICE(today=lambda: FIXED_TODAY)


class PublicFacilityApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = FastAPI()
        app.include_router(public_router.router, prefix="/api/v1")
        cls.client = TestClient(app)

    def setUp(self):
        self.service_patch = patch.object(public_router, "_service", side_effect=fixed_service)
        self.service_patch.start()

    def tearDown(self):
        self.service_patch.stop()

    def test_list_uses_frozen_pagination_envelope(self):
        response = self.client.get("/api/v1/public-facilities?page=1&pageSize=2")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual((payload["page"], payload["pageSize"]), (1, 2))
        self.assertEqual(payload["total"], len(public_router.load_registry().facilities))
        self.assertEqual(len(payload["items"]), 2)
        self.assertEqual(payload["asOf"], FIXED_TODAY.isoformat())
        self.assertIn("registryVersion", payload)

    def test_state_operator_type_and_query_filters_compose(self):
        facility = public_router.load_registry().facilities[0]
        params = {
            "state": facility.stateCode,
            "operator": facility.operator,
            "facilityType": facility.facilityType,
            "q": facility.city,
            "freshness": "current",
        }
        response = self.client.get("/api/v1/public-facilities", params=params)
        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        self.assertTrue(items)
        for item in items:
            self.assertEqual(item["stateCode"], facility.stateCode)
            self.assertEqual(item["operator"].casefold(), facility.operator.casefold())
            self.assertEqual(item["facilityType"], facility.facilityType)
            self.assertIn(facility.city.casefold(), " ".join((item["name"], item["operator"], item["city"], item["locality"], item["state"])).casefold())

    def test_summary_matches_publishable_registry_without_capacity_total(self):
        response = self.client.get("/api/v1/public-facilities/summary")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["operationalFacilityCount"], len(public_router.load_registry().facilities))
        self.assertEqual(payload["capacityAggregation"], "disabled_mixed_measurement_boundaries")
        self.assertNotIn("totalCapacity", payload)

    def test_detail_contains_only_generalized_geometry_and_typed_capacity(self):
        facility = public_router.load_registry().facilities[0]
        response = self.client.get(f"/api/v1/public-facilities/{facility.id}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["publicCoordinates"], list(facility.publicCoordinates))
        self.assertNotIn("exactCoordinates", payload)
        self.assertNotIn("restrictedGeometry", payload)
        for capacity in payload["capacityDisclosures"]:
            self.assertEqual(set(capacity), {"value", "unit", "capacityType", "scope"})

    def test_missing_detail_uses_non_disclosing_standard_error(self):
        response = self.client.get(
            "/api/v1/public-facilities/not-a-real-facility",
            headers={"x-request-id": "req_test_missing"},
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {
                "error": {
                    "code": "facility_not_found",
                    "message": "Public facility not found.",
                    "details": {},
                    "requestId": "req_test_missing",
                }
            },
        )

    def test_invalid_filters_use_safe_standard_validation_error(self):
        cases = (
            {"state": "IN-GJ"},
            {"facilityType": "warehouse"},
            {"freshness": "stale"},
            {"page": "0"},
            {"pageSize": "101"},
        )
        for params in cases:
            with self.subTest(params=params):
                response = self.client.get("/api/v1/public-facilities", params=params)
                self.assertEqual(response.status_code, 422)
                payload = response.json()["error"]
                self.assertEqual(payload["code"], "validation_failed")
                self.assertEqual(payload["message"], "Request validation failed.")
                self.assertTrue(payload["details"]["fields"])
                self.assertTrue(payload["requestId"].startswith("req_"))


if __name__ == "__main__":
    unittest.main()
