import unittest
from datetime import datetime, timezone

from backend.app.services.ministry_operations import *


NOW = datetime(2026, 10, 29, 10, 0, tzinfo=timezone.utc)


class Repository:
    def state_summaries(self): return [MinistryStateSummary("IN-TG", 2, 1, 1, 0), MinistryStateSummary("IN-MH", 3, 2, 0, 1)]
    def source_health(self): return [MinistrySourceHealth("imd", "IMD", "CONNECTED", NOW, NOW, 0, 0)]
    def facility_freshness(self): return [
        FacilityFreshness("a", "A", "IN-MH", "pm25", "current", NOW, 10, "cpcb"),
        FacilityFreshness("b", "B", "IN-MH", "temperature", "unavailable", None, None, "imd", "provider down"),
        FacilityFreshness("c", "C", "IN-TG", "groundwater_depth", "stale", NOW, 9000, "nwdp"),
    ]


class MinistryOperationsTests(unittest.TestCase):
    def test_overview_prioritizes_unavailable_then_stale(self):
        result = MinistryOperationsService(Repository(), lambda: NOW).overview()
        self.assertEqual(result.facility_count, 5)
        self.assertEqual([row.facility_id for row in result.freshness_queue], ["b", "c", "a"])
        self.assertEqual([row.state_code for row in result.states], ["IN-MH", "IN-TG"])


if __name__ == "__main__": unittest.main()
