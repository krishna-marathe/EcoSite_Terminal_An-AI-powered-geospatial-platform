"""Risk score, provider parameter mapping and the public risk endpoint."""
from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app import main as api
from backend.app.services import facility_context
from backend.app.services.facility_context import ProviderResult
from backend.app.services.risk_scoring import (
    PARAMETERS,
    PARAMETER_BY_KEY,
    TOTAL_WEIGHT,
    Missing,
    Reading,
    assess,
    band_for,
    interpolate_risk,
)

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def reading(value: float, key: str = "") -> Reading:
    return Reading(
        value=value,
        observed_at=NOW,
        provider="test provider",
        source_url="https://example.test/api",
        quality="modelled",
        detail={"key": key},
    )


def full_readings(**overrides) -> dict:
    values = {
        "air.aqi_us": 82.0,
        "air.pm25": 23.2,
        "air.pm10": 90.0,
        "heat.temperature_max": 30.6,
        "water.rainfall_24h": 0.0,
        "water.river_discharge_percentile": 50.0,
    }
    values.update(overrides)
    readings = {key: reading(value) for key, value in values.items()}
    readings["water.groundwater_depth"] = Missing("not connected")
    readings["water.surface_water_occurrence"] = Missing("not connected")
    return readings


class RiskModelTests(unittest.TestCase):
    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(TOTAL_WEIGHT, 1.0, places=9)
        self.assertAlmostEqual(sum(parameter.weight for parameter in PARAMETERS), 1.0, places=9)

    def test_curves_are_monotonic_and_bounded(self):
        for parameter in PARAMETERS:
            previous = -1.0
            for point in parameter.curve:
                self.assertGreaterEqual(point.risk, previous)
                self.assertGreaterEqual(point.risk, 0.0)
                self.assertLessEqual(point.risk, 100.0)
                previous = point.risk
            first, last = parameter.curve[0], parameter.curve[-1]
            self.assertEqual(interpolate_risk(parameter, first.value - 1000), first.risk)
            self.assertEqual(interpolate_risk(parameter, last.value + 1000), last.risk)

    def test_interpolation_midpoint(self):
        aqi = PARAMETER_BY_KEY["air.aqi_us"]
        # Between 50 (risk 15) and 100 (risk 35), the midpoint is 25.
        self.assertAlmostEqual(interpolate_risk(aqi, 75.0), 25.0, places=6)

    def test_score_uses_only_available_parameters_and_reports_coverage(self):
        assessment = assess("fac-1", full_readings(), NOW)
        self.assertIsNotNone(assessment.score)
        self.assertEqual(assessment.coverage, round(1 - 0.12 - 0.10, 4))
        self.assertEqual(assessment.confidence, "medium")
        scores = [p.score for p in assessment.parameters if p.score is not None]
        self.assertTrue(min(scores) <= assessment.score <= max(scores))

        missing = [p for p in assessment.parameters if p.status == "UNAVAILABLE"]
        self.assertEqual({p.key for p in missing}, {"water.groundwater_depth", "water.surface_water_occurrence"})
        for parameter in missing:
            self.assertIsNone(parameter.value)
            self.assertIsNone(parameter.score)
            self.assertTrue(parameter.reason)

    def test_score_is_weight_normalised(self):
        readings = {
            "air.aqi_us": reading(0.0),      # risk 5 at weight 0.16
            "air.pm25": reading(150.0),      # risk 100 at weight 0.10
            "water.groundwater_depth": Missing("x"),
            "water.surface_water_occurrence": Missing("x"),
            "air.pm10": Missing("x"),
            "heat.temperature_max": Missing("x"),
            "water.rainfall_24h": Missing("x"),
            "water.river_discharge_percentile": Missing("x"),
        }
        assessment = assess("fac-2", readings, NOW)
        expected = round((5.0 * 0.16 + 100.0 * 0.10) / 0.26, 1)
        self.assertAlmostEqual(assessment.score, expected, places=1)
        self.assertAlmostEqual(assessment.coverage, 0.26, places=4)
        self.assertEqual(assessment.confidence, "low")

    def test_no_available_parameter_is_unknown_not_zero(self):
        readings = {parameter.key: Missing("no provider") for parameter in PARAMETERS}
        assessment = assess("fac-3", readings, NOW)
        self.assertIsNone(assessment.score)
        self.assertEqual(assessment.band, "unknown")
        self.assertEqual(assessment.coverage, 0.0)
        self.assertTrue(all(p.status == "UNAVAILABLE" for p in assessment.parameters))

    def test_absent_parameter_is_reported_not_ignored(self):
        assessment = assess("fac-4", {}, NOW)
        self.assertIsNone(assessment.score)
        keys = {p.key for p in assessment.parameters}
        self.assertEqual(keys, {parameter.key for parameter in PARAMETERS})
        self.assertTrue(all(p.reason for p in assessment.parameters))

    def test_band_boundaries(self):
        self.assertEqual(band_for(None), "unknown")
        self.assertEqual(band_for(0), "low")
        self.assertEqual(band_for(24.9), "low")
        self.assertEqual(band_for(25), "moderate")
        self.assertEqual(band_for(49.9), "moderate")
        self.assertEqual(band_for(50), "high")
        self.assertEqual(band_for(75), "critical")
        self.assertEqual(band_for(100), "critical")


class ProviderTests(unittest.TestCase):
    def setUp(self):
        facility_context.clear_cache()

    def test_percentile_rank(self):
        self.assertEqual(facility_context.percentile_rank([1, 2, 3, 4], 2), 50.0)
        self.assertEqual(facility_context.percentile_rank([1, 2, 3, 4], 99), 100.0)
        self.assertEqual(facility_context.percentile_rank([], 5), 0.0)

    def test_zero_river_flow_is_not_maximum_flood_risk(self):
        document = {"daily": {"time": ["2026-10-29"], "river_discharge": [0.0, 0.0]}}
        with patch.object(facility_context, "_get_json", return_value=document):
            result = facility_context._flood_reading(18.52, 73.85)
        self.assertIsInstance(result, Reading)
        self.assertEqual(result.value, 0.0)
        self.assertIn("no river flow", result.detail["note"].lower())

    def test_flood_percentile_uses_history(self):
        history = [float(value) for value in range(1, 11)]
        document = {"daily": {"time": [], "river_discharge": history + [10.0]}}
        with patch.object(facility_context, "_get_json", return_value=document):
            result = facility_context._flood_reading(18.52, 73.85)
        self.assertIsInstance(result, Reading)
        self.assertEqual(result.value, 100.0)
        self.assertEqual(result.detail["river_discharge_m3s"], 10.0)

    def test_air_quality_mapping(self):
        document = {
            "current": {"time": "2026-10-29T10:00", "us_aqi": 82, "pm2_5": 23.2, "pm10": 90}
        }
        with patch.object(facility_context, "_get_json", return_value=document):
            readings = facility_context._air_readings(18.52, 73.85)
        self.assertEqual(readings["air.aqi_us"].value, 82.0)
        self.assertEqual(readings["air.pm25"].value, 23.2)
        self.assertEqual(readings["air.aqi_us"].quality, "modelled")

    def test_missing_field_becomes_missing_not_zero(self):
        document = {"current": {"time": "2026-10-29T10:00", "us_aqi": 82}}
        with patch.object(facility_context, "_get_json", return_value=document):
            readings = facility_context._air_readings(18.52, 73.85)
        self.assertIsInstance(readings["air.pm25"], Missing)
        self.assertIn("PM2.5", readings["air.pm25"].reason)

    def test_provider_failure_leaves_explicit_gaps(self):
        def failing(url, params):
            raise facility_context.ProviderUnavailable("HTTP 503")

        with patch.object(facility_context, "_get_json", side_effect=failing):
            result = facility_context.collect(18.52, 73.85)
        self.assertEqual(len(result.errors), 3)
        self.assertIsInstance(result.readings["air.aqi_us"], Missing)
        self.assertIsInstance(result.readings["heat.temperature_max"], Missing)
        self.assertIsInstance(result.readings["water.river_discharge_percentile"], Missing)
        assessment = assess("fac-5", result.readings, NOW)
        self.assertIsNone(assessment.score)
        self.assertEqual(assessment.band, "unknown")

    def test_cache_avoids_repeat_fetches(self):
        calls = []

        def counted(url, params):
            calls.append(url)
            return {"current": {"time": "2026-10-29T10:00", "us_aqi": 10, "pm2_5": 1, "pm10": 1},
                    "daily": {"time": ["2026-10-29"], "temperature_2m_max": [30], "precipitation_sum": [0]}}

        with patch.object(facility_context, "_get_json", side_effect=counted):
            facility_context.collect(18.52, 73.85)
            first = len(calls)
            facility_context.collect(18.521, 73.852)
        self.assertEqual(len(calls), first)


class RiskEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(api.app)
        facility_context.clear_cache()

    def test_unknown_facility_is_404(self):
        response = self.client.get("/api/v1/public-facilities/does-not-exist/risk-score")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"]["code"], "facility_not_found")

    def test_score_response_shape_and_honesty(self):
        with patch.object(
            facility_context, "collect", return_value=ProviderResult(readings=full_readings(), errors=())
        ):
            response = self.client.get("/api/v1/public-facilities/iron-mountain-mum-1/risk-score")
            if response.status_code == 404:
                self.fail("A current public facility must accept the risk-score route")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreaterEqual(body["score"], 0)
        self.assertLessEqual(body["score"], 100)
        self.assertIn(body["band"], {"low", "moderate", "high", "critical"})
        self.assertAlmostEqual(body["coverage"], 0.78, places=2)
        unavailable = [item for item in body["parameters"] if item["status"] == "UNAVAILABLE"]
        self.assertTrue(unavailable)
        for item in unavailable:
            self.assertIsNone(item["value"])
            self.assertIsNone(item["score"])
            self.assertTrue(item["reason"])
        self.assertTrue(body["notes"])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
