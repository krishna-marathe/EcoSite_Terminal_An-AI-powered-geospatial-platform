import unittest
from datetime import datetime, timezone

from backend.app.data.connectors.operational import HttpResponse, OperationalObservation
from backend.app.jobs.environmental_ingestion import run_connector


NOW = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)


class Connector:
    source_id = "source"
    parser_version = "v1"

    def __init__(self, fail=False):
        self.fail = fail

    def fetch(self):
        if self.fail:
            raise RuntimeError("down")
        return HttpResponse("https://example", 200, "application/json", b"{}", NOW)

    def parse(self, response):
        return [OperationalObservation("source", "S1", "Station", "pm25", 1.0, "ug/m3", 1.0, "ug/m3", NOW, NOW, "key")]


class Store:
    def __init__(self):
        self.events = []

    def start_run(self, source_id, parser_version, started_at): self.events.append("start"); return "run"
    def save_raw_snapshot(self, run_id, response): self.events.append("raw"); return "raw"
    def save_observations(self, run_id, raw_snapshot_id, observations): self.events.append("observations"); return len(observations)
    def finish_run(self, run_id, status, finished_at, error=None): self.events.append(("finish", status, error))
    def mark_source_stale(self, source_id, checked_at): self.events.append("stale")


class EnvironmentalIngestionJobTests(unittest.TestCase):
    def test_raw_snapshot_is_saved_before_observations(self):
        store = Store()
        result = run_connector(Connector(), store)
        self.assertEqual(store.events[:3], ["start", "raw", "observations"])
        self.assertEqual(result.status, "success")

    def test_failure_marks_source_stale_and_closes_run(self):
        store = Store()
        with self.assertRaises(RuntimeError):
            run_connector(Connector(fail=True), store)
        self.assertIn("stale", store.events)
        self.assertIn(("finish", "failed", "RuntimeError"), store.events)


if __name__ == "__main__":
    unittest.main()
