import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path

from backend.scripts.validate_public_registry import DEFAULT_REGISTRY, main, validate_registry


class PublicRegistryValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current = json.loads(DEFAULT_REGISTRY.read_text(encoding="utf-8"))

    def test_current_seed_has_no_errors_and_reports_capture_warnings(self):
        result = validate_registry(self.current, as_of=date(2026, 10, 29))
        self.assertFalse([item for item in result if item.severity == "error"])
        self.assertEqual(len([item for item in result if item.code == "source_capture_missing"]), len(self.current["facilities"]))

    def test_rejects_geography_dates_source_and_capacity_contract_violations(self):
        value = copy.deepcopy(self.current)
        facility = value["facilities"][0]
        facility["state"] = "Tamil Nadu"
        facility["publicCoordinates"] = [80.27, 13.08]
        facility["operationalSince"] = 2030
        facility["capacityDisclosures"][0].update({"unit": "GW", "scope": "unknown"})
        facility["verification"]["expiresAt"] = "2027-12-31"
        facility["verification"]["source"]["url"] = "http://example.test/facility"
        codes = {item.code for item in validate_registry(value, as_of=date(2026, 10, 29)) if item.severity == "error"}
        self.assertTrue({"state_name_mismatch", "coordinates_outside_state", "invalid_operational_since", "invalid_capacity_unit", "invalid_capacity_scope", "invalid_verification_window", "invalid_source_url"}.issubset(codes))

    def test_rejects_duplicate_canonical_names_aliases_and_ids(self):
        value = copy.deepcopy(self.current)
        duplicate = copy.deepcopy(value["facilities"][0])
        duplicate["aliases"] = [duplicate["name"]]
        value["facilities"].append(duplicate)
        codes = {item.code for item in validate_registry(value, as_of=date(2026, 10, 29)) if item.severity == "error"}
        self.assertIn("duplicate_id", codes)
        self.assertIn("duplicate_canonical_facility", codes)
        self.assertIn("duplicate_alias", codes)

    def test_optional_capture_metadata_is_validated_and_removes_warning(self):
        value = copy.deepcopy(self.current)
        source = value["facilities"][0]["verification"]["source"]
        source["contentSha256"] = "a" * 64
        result = validate_registry(value, as_of=date(2026, 10, 29))
        path = "facilities[0].verification.source"
        self.assertFalse(any(item.code == "source_capture_missing" and item.path == path for item in result))
        source["contentSha256"] = "not-a-hash"
        self.assertTrue(any(item.code == "invalid_source_hash" for item in validate_registry(value, as_of=date(2026, 10, 29))))

    def test_cli_json_mode_returns_nonzero_for_invalid_registry(self):
        value = copy.deepcopy(self.current)
        value["facilities"][0]["verification"]["source"]["url"] = "not-a-url"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            with redirect_stdout(io.StringIO()) as output:
                self.assertEqual(main([str(path), "--as-of", "2026-10-29", "--json"]), 1)
            self.assertFalse(json.loads(output.getvalue())["valid"])


if __name__ == "__main__":
    unittest.main()
