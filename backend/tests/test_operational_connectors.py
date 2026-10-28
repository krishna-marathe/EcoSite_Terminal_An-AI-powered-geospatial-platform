import json
import unittest
from datetime import datetime, timezone

from backend.app.data.connectors.configured_public_feed import ImdPublicFeedConnector, NwdpGroundwaterConnector
from backend.app.data.connectors.cpcb_datagov import CpcbDataGovConnector, MetricField
from backend.app.data.connectors.operational import ConnectorNotConfigured, HttpResponse


NOW = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)


class Transport:
    def __init__(self):
        self.call = None

    def get(self, url, *, params, headers, timeout):
        self.call = (url, params, headers, timeout)
        payload = {"records": [{"station": "S1", "name": "Station 1", "time": "2026-10-29T08:00:00+05:30", "lon": "72.8", "lat": "19.1", "pm": "41.2"}]}
        return HttpResponse(url, 200, "application/json", json.dumps(payload).encode(), NOW)


class OperationalConnectorTests(unittest.TestCase):
    def test_cpcb_requires_server_configuration(self):
        with self.assertRaises(ConnectorNotConfigured):
            CpcbDataGovConnector.from_environment({})

    def test_cpcb_api_key_is_sent_only_by_server_transport(self):
        transport = Transport()
        connector = CpcbDataGovConnector(
            endpoint="https://api.example/resource", resource_id="resource-id", api_key="server-secret",
            station_id_field="station", station_name_field="name", timestamp_field="time",
            longitude_field="lon", latitude_field="lat",
            metric_fields={"pm25": MetricField("pm", "ug/m3", "ug/m3")}, transport=transport,
        )
        observations = connector.parse(connector.fetch())
        self.assertEqual(transport.call[1]["api-key"], "server-secret")
        self.assertEqual((observations[0].metric_key, observations[0].value), ("pm25", 41.2))
        self.assertEqual(observations[0].observed_at.isoformat(), "2026-10-29T02:30:00+00:00")

    def test_imd_and_nwdp_remain_disabled_even_with_unverified_endpoint(self):
        for connector, variable in ((ImdPublicFeedConnector, "ECOSITE_IMD_ENDPOINT"), (NwdpGroundwaterConnector, "ECOSITE_NWDP_ENDPOINT")):
            with self.subTest(connector=connector.__name__), self.assertRaises(ConnectorNotConfigured) as error:
                connector.from_environment({variable: "https://configured.example"})
            self.assertIn("response contract is not verified", str(error.exception))


if __name__ == "__main__":
    unittest.main()
