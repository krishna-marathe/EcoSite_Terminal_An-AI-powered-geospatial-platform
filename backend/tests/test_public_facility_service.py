import json
import tempfile
import unittest
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from backend.app.services.public_facilities import (
    FacilityFilters,
    JsonRegistryRepository,
    PageRequest,
    PublicFacilityNotFound,
    PublicFacilityService,
    RegistrySnapshot,
)


@dataclass(frozen=True)
class MemoryRepository:
    value: RegistrySnapshot[dict]

    def snapshot(self) -> RegistrySnapshot[dict]:
        return self.value


def facility(identifier, *, state="IN-MH", operator="Operator A", kind="colocation", expires="2027-01-01"):
    return {
        "id": identifier,
        "name": f"Facility {identifier}",
        "operator": operator,
        "facilityType": kind,
        "stateCode": state,
        "state": {"IN-MH": "Maharashtra", "IN-TG": "Telangana"}[state],
        "city": "Mumbai" if state == "IN-MH" else "Hyderabad",
        "locality": "Generalized locality",
        "publicCoordinates": [72.8, 19.1],
        "capacityDisclosures": [{"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"}],
        "verification": {"verifiedAt": "2026-10-01", "expiresAt": expires},
    }


class PublicFacilityServiceTests(unittest.TestCase):
    def setUp(self):
        self.records = (
            facility("mh-b", operator="Operator B"),
            facility("mh-a"),
            facility("tg-a", state="IN-TG", kind="hyperscale"),
            facility("expired", expires="2026-10-15"),
        )
        repository = MemoryRepository(RegistrySnapshot("v1", ("IN-MH", "IN-TG"), self.records))
        self.service = PublicFacilityService(repository, today=lambda: date(2026, 10, 29))

    def test_filters_sorts_and_paginates_current_records(self):
        result = self.service.list_facilities(
            FacilityFilters(state_code="IN-MH", query="facility", freshness="current"),
            PageRequest(page=1, page_size=1),
        )
        self.assertEqual(result.total, 2)
        self.assertEqual(result.items[0]["id"], "mh-a")
        self.assertEqual((result.page, result.page_size, result.registry_version), (1, 1, "v1"))

    def test_operator_and_type_filters_are_independent(self):
        by_operator = self.service.list_facilities(FacilityFilters(operator="operator b"))
        by_type = self.service.list_facilities(FacilityFilters(facility_type="hyperscale"))
        self.assertEqual([item["id"] for item in by_operator.items], ["mh-b"])
        self.assertEqual([item["id"] for item in by_type.items], ["tg-a"])

    def test_detail_does_not_disclose_missing_versus_expired(self):
        for identifier in ("missing", "expired"):
            with self.subTest(identifier=identifier), self.assertRaises(PublicFacilityNotFound) as error:
                self.service.get_facility(identifier)
            self.assertEqual(str(error.exception), "Public facility not found")

    def test_summary_excludes_expired_and_never_aggregates_capacity(self):
        summary = self.service.get_summary()
        self.assertEqual(summary.operational_facility_count, 3)
        self.assertEqual(summary.operator_count, 2)
        self.assertEqual(summary.by_state, {"IN-MH": 2, "IN-TG": 1})
        self.assertEqual(summary.capacity_aggregation, "disabled_mixed_measurement_boundaries")

    def test_public_records_are_returned_unchanged(self):
        result = self.service.get_facility("mh-a")
        self.assertEqual(result["publicCoordinates"], [72.8, 19.1])
        self.assertNotIn("exactCoordinates", result)
        self.assertEqual(result["capacityDisclosures"][0]["capacityType"], "it_load")

    def test_page_bounds_are_enforced(self):
        for args in ({"page": 0}, {"page_size": 0}, {"page_size": 101}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                PageRequest(**args)

    def test_json_adapter_delegates_validation_to_parser(self):
        payload = {"registryVersion": "v2", "scope": ["IN-MH"], "facilities": [facility("mh-a")]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            repository = JsonRegistryRepository(path, json.loads)
            snapshot = repository.snapshot()
        self.assertEqual(snapshot.registry_version, "v2")
        self.assertEqual(snapshot.facilities[0]["id"], "mh-a")


if __name__ == "__main__":
    unittest.main()
