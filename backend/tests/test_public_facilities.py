import unittest
from datetime import date

from backend.app.routers.public_facilities import current_public_facilities, load_registry, publishable


class PublicFacilityRegistryTests(unittest.TestCase):
    def test_registry_is_valid_and_unique(self):
        registry = load_registry()
        self.assertEqual(len(registry.facilities), len({facility.id for facility in registry.facilities}))
        self.assertEqual(set(registry.scope), {"IN-MH", "IN-TG", "IN-KA", "IN-TN"})
        self.assertTrue(registry.facilities)

    def test_public_contract_contains_only_generalized_geometry(self):
        for facility in load_registry().facilities:
            payload = facility.model_dump(mode="json")
            self.assertIn(facility.locationPrecision, {"locality", "district"})
            self.assertNotIn("exactCoordinates", payload)
            self.assertNotIn("campusGeometry", payload)
            self.assertNotIn("contact", payload)

    def test_verification_window_is_at_most_ninety_days(self):
        for facility in load_registry().facilities:
            window = (facility.verification.expiresAt - facility.verification.verifiedAt).days
            self.assertLessEqual(window, 90)
            self.assertTrue(publishable(facility, facility.verification.verifiedAt))
            self.assertFalse(publishable(facility, date(2028, 1, 1)))

    def test_capacity_types_are_not_summed_or_normalized(self):
        capacity_types = {
            disclosure.capacityType
            for facility in load_registry().facilities
            for disclosure in facility.capacityDisclosures
        }
        self.assertIn("it_load", capacity_types)
        self.assertIn("total_power", capacity_types)
        self.assertIn("power_capacity", capacity_types)

    def test_current_records_can_be_evaluated_without_fastapi_query_defaults(self):
        records = current_public_facilities(date(2026, 10, 29))
        self.assertEqual(len(records), len(load_registry().facilities))


if __name__ == "__main__":
    unittest.main()
