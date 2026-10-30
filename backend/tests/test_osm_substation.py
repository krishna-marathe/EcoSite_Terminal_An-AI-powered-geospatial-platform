import json
import unittest
from backend.app.data.connectors.base import FetchRequest, RawPayload
from backend.app.data.connectors.osm_substation import (
    OsmSubstationConnector,
    _parse_voltage,
    _haversine_m,
    VERIFIED_REGIONAL_SUBSTATIONS,
)

MOCK_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[
        [73.85, 18.52],
        [73.86, 18.52],
        [73.86, 18.53],
        [73.85, 18.53],
        [73.85, 18.52]
    ]]
}


class OsmSubstationConnectorTests(unittest.TestCase):
    def setUp(self):
        self.connector = OsmSubstationConnector()
        self.request = FetchRequest(
            geometry=MOCK_GEOMETRY,
            geometry_hash="test_pune_hash",
            buffer_m=5000.0,
        )

    def test_voltage_parser(self):
        self.assertEqual(_parse_voltage("220 kV"), 220.0)
        self.assertEqual(_parse_voltage("400"), 400.0)
        self.assertEqual(_parse_voltage("220000;110000"), 220.0)
        self.assertEqual(_parse_voltage("66kV"), 66.0)
        self.assertIsNone(_parse_voltage(""))
        self.assertIsNone(_parse_voltage(None))

    def test_haversine_distance(self):
        dist = _haversine_m(0.0, 0.0, 0.0, 1.0)
        self.assertAlmostEqual(dist, 111319.5, delta=500.0)

    def test_parse_sample_payload(self):
        sample_elements = [
            {
                "type": "node",
                "id": 101,
                "lat": 18.535,
                "lon": 73.855,
                "tags": {
                    "name": "Local 220kV Receiving Station",
                    "voltage": "220 kV",
                    "operator": "MSETCL",
                },
            },
            {
                "type": "node",
                "id": 102,
                "lat": 18.58,
                "lon": 73.89,
                "tags": {
                    "name": "District 110kV Substation",
                    "voltage": "110 kV",
                    "operator": "MSETCL",
                },
            },
        ]
        raw_json = json.dumps({"elements": sample_elements, "is_live_overpass": True}).encode("utf-8")
        payload = RawPayload(
            source_id="osm_overpass",
            url="https://overpass-api.de/api/interpreter",
            content=raw_json,
            content_type="application/json",
            http_status=200,
            fetched_at="2026-10-29T12:00:00Z",
            filename="osm.json",
            dataset_version="OSM Overpass 2026",
            is_live=True,
        )

        records = self.connector.parse([payload], self.request)
        self.assertEqual(len(records), 3)

        indicators = {r.indicator: r for r in records}
        self.assertIn("substation_distance", indicators)
        self.assertIn("substation_voltage", indicators)
        self.assertIn("substations_within_5km", indicators)

        dist_record = indicators["substation_distance"]
        self.assertEqual(dist_record.unit, "m")
        self.assertEqual(dist_record.status, "AVAILABLE")
        self.assertGreater(dist_record.value, 0.0)
        self.assertLess(dist_record.value, 5000.0)

        voltage_record = indicators["substation_voltage"]
        self.assertEqual(voltage_record.unit, "kV")
        self.assertEqual(voltage_record.value, 220.0)
        self.assertEqual(voltage_record.status, "AVAILABLE")

        count_record = indicators["substations_within_5km"]
        self.assertEqual(count_record.unit, "count")
        self.assertEqual(count_record.value, 1.0)
        self.assertEqual(count_record.status, "AVAILABLE")


if __name__ == "__main__":
    unittest.main()
