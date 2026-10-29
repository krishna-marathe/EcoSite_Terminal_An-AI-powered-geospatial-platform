import json
import unittest
from backend.app.data.connectors.base import FetchRequest, RawPayload
from backend.app.data.connectors.worldpop import WorldPopConnector, _lookup_baseline_density

MOCK_PUNE_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[
        [73.85, 18.52],
        [73.86, 18.52],
        [73.86, 18.53],
        [73.85, 18.53],
        [73.85, 18.52]
    ]]
}


class WorldPopConnectorTests(unittest.TestCase):
    def setUp(self):
        self.connector = WorldPopConnector()
        self.request = FetchRequest(
            geometry=MOCK_PUNE_GEOMETRY,
            geometry_hash="test_worldpop_pune",
            buffer_m=1000.0,
        )

    def test_lookup_baseline_density(self):
        # Pune coordinates
        density, label = _lookup_baseline_density(18.52, 73.85)
        self.assertGreater(density, 500.0)
        self.assertIn("Pune", label)

        # Mumbai Suburban coordinates
        mumbai_density, mumbai_label = _lookup_baseline_density(19.11, 72.87)
        self.assertGreater(mumbai_density, 15000.0)
        self.assertIn("Mumbai", mumbai_label)

    def test_parse_sample_payload(self):
        sample_data = {
            "density_per_sqkm": 2840.0,
            "population_1km": 8920,
            "source": "WorldPop 100m Modelled",
        }
        raw_json = json.dumps({"data": sample_data, "is_live_worldpop": True}).encode("utf-8")
        payload = RawPayload(
            source_id="worldpop",
            url="https://api.worldpop.org/v1/services/stats",
            content=raw_json,
            content_type="application/json",
            http_status=200,
            fetched_at="2026-10-29T12:00:00Z",
            filename="worldpop.json",
            dataset_version="WorldPop 2020 100m (wpgppop)",
            is_live=True,
        )

        records = self.connector.parse([payload], self.request)
        self.assertEqual(len(records), 2)

        indicators = {r.indicator: r for r in records}
        self.assertIn("population_density", indicators)
        self.assertIn("population_count_1km", indicators)

        density_rec = indicators["population_density"]
        self.assertEqual(density_rec.unit, "persons_per_sqkm")
        self.assertEqual(density_rec.status, "AVAILABLE")
        self.assertEqual(density_rec.value, 2840.0)

        count_rec = indicators["population_count_1km"]
        self.assertEqual(count_rec.unit, "persons")
        self.assertEqual(count_rec.status, "AVAILABLE")
        self.assertEqual(count_rec.value, 8920.0)


if __name__ == "__main__":
    unittest.main()
