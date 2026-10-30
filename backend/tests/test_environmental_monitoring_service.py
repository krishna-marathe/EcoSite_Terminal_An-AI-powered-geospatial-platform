import unittest
from datetime import datetime, timedelta, timezone

from backend.app.services.environmental_monitoring import (
    CurrentMetric,
    EnvironmentalFacilityNotFound,
    EnvironmentalMonitoringService,
    InvalidEnvironmentalQuery,
    MetricSeries,
    StateSummary,
    resolve_interval,
)


NOW = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)


class Repository:
    def is_public_facility(self, facility_id):
        return facility_id == "facility-1"

    def current_metrics(self, facility_id, metrics):
        values = {
            "pm25": CurrentMetric("pm25", "PM2.5", 41.2, "ug/m3", "AVAILABLE", "preliminary", NOW - timedelta(hours=1), NOW, NOW, NOW + timedelta(hours=1), (), None, None, "context"),
            "temperature": CurrentMetric("temperature", "Temperature", 30.0, "degC", "AVAILABLE", "preliminary", NOW - timedelta(hours=4), NOW, NOW, NOW - timedelta(hours=2), (), None, None, "context"),
            "rainfall": CurrentMetric("rainfall", "Rainfall", None, "mm", "AVAILABLE", "unknown", NOW, NOW, NOW, NOW + timedelta(hours=1), (), None, None, "context"),
        }
        return [values[key] for key in metrics if key in values]

    def metric_series(self, facility_id, metrics, start, end, interval):
        if "temperature" not in metrics:
            return []
        return [MetricSeries("temperature", "Temperature", "degC", "AVAILABLE", "preliminary", 1.0, 24, 24, None, None, (), "context")]

    def state_summary(self, state_code, metrics, range_key):
        return StateSummary(state_code, range_key, NOW, 8, 0, (), ())


class EnvironmentalMonitoringServiceTests(unittest.TestCase):
    def setUp(self):
        self.service = EnvironmentalMonitoringService(Repository(), clock=lambda: NOW)

    def test_current_marks_stale_missing_and_not_covered(self):
        result = self.service.get_current("facility-1", ["pm25", "temperature", "rainfall", "groundwater_depth"])
        statuses = {item.metric: item.availability for item in result.metrics}
        self.assertEqual(statuses, {"pm25": "AVAILABLE", "temperature": "STALE", "rainfall": "UNKNOWN", "groundwater_depth": "NOT_COVERED"})
        rainfall = next(item for item in result.metrics if item.metric == "rainfall")
        self.assertIsNone(rainfall.value)
        self.assertIn("missing_value", rainfall.quality_flags)

    def test_range_resolves_interval_and_preserves_empty_series(self):
        result = self.service.get_range("facility-1", ["temperature", "groundwater_depth"], "30d", "auto")
        self.assertEqual(result.interval, "day")
        self.assertEqual(result.from_at, NOW - timedelta(days=30))
        self.assertEqual([item.availability for item in result.series], ["AVAILABLE", "NOT_COVERED"])

    def test_raw_long_range_and_unknown_metrics_are_rejected(self):
        with self.assertRaises(InvalidEnvironmentalQuery):
            self.service.get_range("facility-1", ["pm25"], "90d", "raw")
        with self.assertRaises(InvalidEnvironmentalQuery):
            self.service.get_current("facility-1", ["invented"])

    def test_missing_and_expired_facilities_share_one_error(self):
        with self.assertRaises(EnvironmentalFacilityNotFound) as error:
            self.service.get_current("not-public", ["pm25"])
        self.assertEqual(str(error.exception), "Public facility not found")

    def test_interval_policy(self):
        self.assertEqual(resolve_interval("24h", "auto"), "hour")
        self.assertEqual(resolve_interval("7d", "auto"), "hour")
        self.assertEqual(resolve_interval("1y", "auto"), "day")

    def test_original_measurement_fields_are_preserved(self):
        metric = CurrentMetric(
            "temperature", "Temperature", 30.0, "degC", "AVAILABLE", "preliminary",
            NOW, NOW, NOW, NOW + timedelta(hours=1), (), None, None, "context",
            original_value=86.0, original_unit="degF",
        )
        self.assertEqual((metric.original_value, metric.original_unit), (86.0, "degF"))


if __name__ == "__main__":
    unittest.main()
