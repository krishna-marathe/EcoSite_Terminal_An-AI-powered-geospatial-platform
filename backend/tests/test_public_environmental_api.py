import unittest
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace as NS

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.routers.public_environmental import router
from backend.app.db import DB_PATH, make_engine
from backend.app.services.environmental_monitoring import (
    EnvironmentalFacilityNotFound,
    InvalidEnvironmentalQuery,
)
from backend.app.services.environmental_sqlalchemy import SqlAlchemyEnvironmentalRepository
from backend.app.services.environmental_monitoring import EnvironmentalMonitoringService


NOW = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)


def station():
    return NS(
        station_id="cpcb-123",
        name="Powai monitoring station",
        provider="Central Pollution Control Board",
        source_id="cpcb_caaqms",
        public_coordinates=(72.905, 19.119),
        station_type="urban_background",
        distance_km=2.4,
        selection_method="nearest_eligible",
        effective_at=NOW - timedelta(days=28),
    )


def provenance():
    return NS(
        source_id="cpcb_caaqms",
        provider="Central Pollution Control Board",
        dataset="CAAQMS current observations",
        source_url="https://example.gov.in/source",
        retrieved_at=NOW,
        evidence_class="measured",
        temporal_class="near_real_time",
        visibility="public",
    )


class FakeService:
    def get_current(self, facility_id, metrics=None):
        if facility_id == "missing-facility":
            raise EnvironmentalFacilityNotFound("Public facility not found")
        return NS(
            facility_id=facility_id,
            generated_at=NOW,
            metrics=(
                NS(
                    metric="pm25",
                    display_name="PM2.5",
                    value=41.2,
                    unit="ug/m3",
                    original_value=0.0412,
                    original_unit="mg/m3",
                    availability="AVAILABLE",
                    quality="preliminary",
                    observed_at=NOW - timedelta(hours=1),
                    published_at=NOW - timedelta(minutes=30),
                    retrieved_at=NOW,
                    fresh_until=NOW + timedelta(hours=1),
                    quality_flags=(),
                    station=station(),
                    provenance=provenance(),
                    context_notice="Nearby public monitoring-station context; not an on-site facility measurement.",
                ),
            ),
        )

    def get_range(self, facility_id, metrics, range_key="24h", interval="auto"):
        if interval == "raw" and range_key in {"30d", "90d", "1y"}:
            raise InvalidEnvironmentalQuery("Raw interval exceeds the supported point window")
        point = NS(
            timestamp=NOW - timedelta(hours=1),
            value=29.1,
            original_value=84.38,
            original_unit="degF",
            minimum=28.7,
            maximum=29.5,
            sample_count=4,
            coverage_fraction=1.0,
            quality_flags=(),
        )
        series = NS(
            metric="temperature",
            display_name="Temperature",
            unit="degC",
            availability="AVAILABLE",
            quality="validated",
            coverage_fraction=1.0,
            expected_sample_count=24,
            valid_sample_count=24,
            station=station(),
            provenance=provenance(),
            points=(point,),
            context_notice="Nearby public monitoring-station context; not an on-site facility measurement.",
        )
        return NS(
            facility_id=facility_id,
            range=range_key,
            interval="hour" if interval == "auto" else interval,
            from_at=NOW - timedelta(hours=24),
            to_at=NOW,
            generated_at=NOW,
            series=(series,),
        )

    def get_state_summary(self, state_code, metrics=None, range_key="24h"):
        metric = NS(
            metric="aqi",
            display_name="Air Quality Index",
            unit="index",
            availability="PARTIAL",
            covered_facility_count=7,
            current_facility_count=6,
            stale_facility_count=1,
            unavailable_facility_count=1,
            minimum=62.0,
            maximum=148.0,
            mean=101.4,
            aggregation_method="facility_context_mean",
            context_notice="Summary of nearby public stations linked to facilities; not facility-caused pollution.",
        )
        source = NS(
            source_id="cpcb_caaqms",
            status="CONNECTED",
            last_checked_at=NOW,
            last_success_at=NOW,
        )
        return NS(
            state_code=state_code,
            range=range_key,
            generated_at=NOW,
            facility_count=8,
            covered_facility_count=7,
            metrics=(metric,),
            source_health=(source,),
        )


class PublicEnvironmentalApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = FastAPI()
        app.state.environmental_monitoring_service = FakeService()
        app.include_router(router, prefix="/api/v1")
        cls.client = TestClient(app)

    def test_current_preserves_station_freshness_quality_and_original_unit(self):
        response = self.client.get("/api/v1/public-facilities/facility-1/environmental/current?metrics=pm25")
        self.assertEqual(response.status_code, 200)
        metric = response.json()["metrics"][0]
        self.assertEqual((metric["value"], metric["unit"]), (41.2, "ug/m3"))
        self.assertEqual((metric["originalValue"], metric["originalUnit"]), (0.0412, "mg/m3"))
        self.assertEqual(metric["quality"], "preliminary")
        self.assertEqual(metric["station"]["distanceKm"], 2.4)
        self.assertIn("not an on-site", metric["contextNotice"])

    def test_range_maps_resolved_interval_points_and_original_unit(self):
        response = self.client.get(
            "/api/v1/public-facilities/facility-1/environmental",
            params={"metrics": "temperature", "range": "24h", "interval": "auto"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["interval"], "hour")
        self.assertIn("from", payload)
        point = payload["series"][0]["points"][0]
        self.assertEqual((point["originalValue"], point["originalUnit"]), (84.38, "degF"))

    def test_state_summary_is_explicitly_contextual(self):
        response = self.client.get("/api/v1/environmental/summary?state=IN-MH&range=24h&metrics=aqi")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["stateCode"], "IN-MH")
        self.assertEqual(payload["sourceHealth"][0]["status"], "CONNECTED")
        self.assertIn("not facility-caused", payload["metrics"][0]["contextNotice"])

    def test_missing_facility_and_invalid_range_combination_use_standard_errors(self):
        missing = self.client.get("/api/v1/public-facilities/missing-facility/environmental/current")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json()["error"]["code"], "facility_not_found")

        invalid = self.client.get(
            "/api/v1/public-facilities/facility-1/environmental",
            params={"metrics": "pm25", "range": "90d", "interval": "raw"},
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json()["error"]["code"], "invalid_request")

    def test_unconfigured_service_fails_closed_without_provider_call(self):
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        response = TestClient(app).get("/api/v1/public-facilities/facility-1/environmental/current")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "service_unavailable")

    def test_copied_live_database_returns_not_covered_without_fetching(self):
        with tempfile.TemporaryDirectory() as directory:
            copied = Path(directory) / "ecosite-copy.db"
            shutil.copy2(DB_PATH, copied)
            engine = make_engine(copied)
            try:
                repository = SqlAlchemyEnvironmentalRepository(
                    lambda: Session(engine, expire_on_commit=False),
                    clock=lambda: NOW,
                )
                app = FastAPI()
                app.state.environmental_monitoring_service = EnvironmentalMonitoringService(
                    repository,
                    clock=lambda: NOW,
                )
                app.include_router(router, prefix="/api/v1")
                client = TestClient(app)

                facility_id = "ctrls-mumbai-dc-1-2"
                # Populated metrics return AVAILABLE with realistic cached data
                response = client.get(
                    f"/api/v1/public-facilities/{facility_id}/environmental/current",
                    params={"metrics": "pm25,groundwater_depth"},
                )
                self.assertEqual(response.status_code, 200)
                metrics = response.json()["metrics"]
                self.assertEqual([item["availability"] for item in metrics], ["AVAILABLE", "AVAILABLE"])
                self.assertTrue(all(item["value"] is not None for item in metrics))

                series = client.get(
                    f"/api/v1/public-facilities/{facility_id}/environmental",
                    params={"metrics": "temperature", "range": "24h", "interval": "auto"},
                )
                self.assertEqual(series.status_code, 200)
                self.assertEqual(series.json()["series"][0]["availability"], "AVAILABLE")
                self.assertGreater(len(series.json()["series"][0]["points"]), 0)

                # Unlinked metrics return NOT_COVERED gracefully without provider call
                with engine.begin() as conn:
                    from sqlalchemy import text
                    conn.execute(text("DELETE FROM facility_station_links WHERE facility_id = :fid AND metric_key IN ('no2', 'so2')"), {"fid": facility_id})

                unlinked = client.get(
                    f"/api/v1/public-facilities/{facility_id}/environmental/current",
                    params={"metrics": "no2,so2"},
                )
                self.assertEqual(unlinked.status_code, 200)
                unlinked_metrics = unlinked.json()["metrics"]
                self.assertEqual([item["availability"] for item in unlinked_metrics], ["NOT_COVERED", "NOT_COVERED"])
                self.assertTrue(all(item["value"] is None for item in unlinked_metrics))
            finally:
                engine.dispose()

    def test_provenance_url_safety_fallback_on_malformed_urls(self):
        """Verify that malformed URLs (http://, https://, http:// , whitespace, etc.)
        do NOT throw 500 or ValidationError, but return status 200 with fallback to https://data.gov.in."""
        malformed_urls = [
            "http://",
            "https://",
            "http:// ",
            "",
            "   ",
            "http://foo bar",
            "not-a-url",
            None,
            "javascript:alert(1)",
            "ftp://invalid-scheme.org",
        ]

        for malformed in malformed_urls:
            with self.subTest(malformed_url=malformed):
                class MalformedProvenanceService:
                    def get_current(self, facility_id, metrics=None):
                        return NS(
                            facility_id=facility_id,
                            generated_at=NOW,
                            metrics=(
                                NS(
                                    metric="pm25",
                                    display_name="PM2.5",
                                    value=41.2,
                                    unit="ug/m3",
                                    original_value=0.0412,
                                    original_unit="mg/m3",
                                    availability="AVAILABLE",
                                    quality="preliminary",
                                    observed_at=NOW - timedelta(hours=1),
                                    published_at=NOW - timedelta(minutes=30),
                                    retrieved_at=NOW,
                                    fresh_until=NOW + timedelta(hours=1),
                                    quality_flags=(),
                                    station=station(),
                                    provenance=NS(
                                        source_id="cpcb_caaqms",
                                        provider="Central Pollution Control Board",
                                        dataset="CAAQMS current observations",
                                        source_url=malformed,
                                        retrieved_at=NOW,
                                        evidence_class="measured",
                                        temporal_class="near_real_time",
                                        visibility="public",
                                    ),
                                    context_notice="Nearby public monitoring-station context.",
                                ),
                            ),
                        )

                    def get_range(self, facility_id, metrics, range_key="24h", interval="auto"):
                        return NS(
                            facility_id=facility_id,
                            range=range_key,
                            interval="hour",
                            from_at=NOW - timedelta(hours=24),
                            to_at=NOW,
                            generated_at=NOW,
                            series=(
                                NS(
                                    metric="pm25",
                                    display_name="PM2.5",
                                    unit="ug/m3",
                                    availability="AVAILABLE",
                                    quality="validated",
                                    coverage_fraction=1.0,
                                    expected_sample_count=24,
                                    valid_sample_count=24,
                                    station=station(),
                                    provenance=NS(
                                        source_id="cpcb_caaqms",
                                        provider="Central Pollution Control Board",
                                        dataset="CAAQMS",
                                        source_url=malformed,
                                        retrieved_at=NOW,
                                        evidence_class="measured",
                                        temporal_class="near_real_time",
                                        visibility="public",
                                    ),
                                    points=(),
                                    context_notice="Nearby public monitoring-station context.",
                                ),
                            ),
                        )

                app = FastAPI()
                app.state.environmental_monitoring_service = MalformedProvenanceService()
                app.include_router(router, prefix="/api/v1")
                client = TestClient(app, raise_server_exceptions=False)

                # Test /current endpoint
                resp_current = client.get("/api/v1/public-facilities/facility-1/environmental/current?metrics=pm25")
                self.assertEqual(resp_current.status_code, 200, f"Expected 200 on malformed URL {malformed!r}, got {resp_current.status_code}")
                prov_current = resp_current.json()["metrics"][0]["provenance"]
                self.assertTrue(
                    str(prov_current["sourceUrl"]).startswith("https://data.gov.in"),
                    f"Expected fallback to data.gov.in for {malformed!r}, got {prov_current['sourceUrl']}",
                )

                # Test /range endpoint
                resp_range = client.get("/api/v1/public-facilities/facility-1/environmental?metrics=pm25&range=24h")
                self.assertEqual(resp_range.status_code, 200, f"Expected 200 on range malformed URL {malformed!r}")
                prov_range = resp_range.json()["series"][0]["provenance"]
                self.assertTrue(
                    str(prov_range["sourceUrl"]).startswith("https://data.gov.in"),
                    f"Expected fallback to data.gov.in in range series for {malformed!r}",
                )

    def test_provenance_url_preserves_valid_urls(self):
        """Verify that genuine valid URLs are preserved without fallback."""
        valid_urls = [
            "https://cpcb.nic.in/caaqms",
            "http://imd.gov.in/weather-station",
            "https://data.gov.in/resource/real-time-air-quality",
        ]
        for valid_url in valid_urls:
            with self.subTest(valid_url=valid_url):
                class ValidProvenanceService:
                    def get_current(self, facility_id, metrics=None):
                        return NS(
                            facility_id=facility_id,
                            generated_at=NOW,
                            metrics=(
                                NS(
                                    metric="pm25",
                                    display_name="PM2.5",
                                    value=41.2,
                                    unit="ug/m3",
                                    original_value=0.0412,
                                    original_unit="mg/m3",
                                    availability="AVAILABLE",
                                    quality="preliminary",
                                    observed_at=NOW - timedelta(hours=1),
                                    published_at=NOW - timedelta(minutes=30),
                                    retrieved_at=NOW,
                                    fresh_until=NOW + timedelta(hours=1),
                                    quality_flags=(),
                                    station=station(),
                                    provenance=NS(
                                        source_id="cpcb_caaqms",
                                        provider="Central Pollution Control Board",
                                        dataset="CAAQMS",
                                        source_url=valid_url,
                                        retrieved_at=NOW,
                                        evidence_class="measured",
                                        temporal_class="near_real_time",
                                        visibility="public",
                                    ),
                                    context_notice="Nearby public station.",
                                ),
                            ),
                        )

                app = FastAPI()
                app.state.environmental_monitoring_service = ValidProvenanceService()
                app.include_router(router, prefix="/api/v1")
                client = TestClient(app, raise_server_exceptions=False)

                resp = client.get("/api/v1/public-facilities/facility-1/environmental/current?metrics=pm25")
                self.assertEqual(resp.status_code, 200)
                prov = resp.json()["metrics"][0]["provenance"]
                self.assertTrue(
                    prov["sourceUrl"].rstrip("/") == valid_url.rstrip("/"),
                    f"Expected preserved URL {valid_url}, got {prov['sourceUrl']}",
                )

    def test_all_nineteen_public_facilities_have_available_standard_metrics(self):
        """Verify that all 19 public facilities in ecosite.db return AVAILABLE status
        with non-null values and linked stations for all 7 standard metrics."""
        standard_metrics = [
            "aqi",
            "pm25",
            "pm10",
            "temperature",
            "relative_humidity",
            "rainfall",
            "groundwater_depth",
        ]
        with tempfile.TemporaryDirectory() as directory:
            copied = Path(directory) / "ecosite-copy.db"
            shutil.copy2(DB_PATH, copied)
            engine = make_engine(copied)
            try:
                repository = SqlAlchemyEnvironmentalRepository(
                    lambda: Session(engine, expire_on_commit=False),
                    clock=lambda: NOW,
                )
                app = FastAPI()
                app.state.environmental_monitoring_service = EnvironmentalMonitoringService(
                    repository,
                    clock=lambda: NOW,
                )
                app.include_router(router, prefix="/api/v1")
                client = TestClient(app)

                facilities = [
                    r[0]
                    for r in engine.connect()
                    .execute(__import__("sqlalchemy").text("SELECT id FROM public_facilities ORDER BY id"))
                    .fetchall()
                ]
                self.assertEqual(len(facilities), 19, f"Expected 19 public facilities, found {len(facilities)}")

                metrics_query = ",".join(standard_metrics)
                for fid in facilities:
                    with self.subTest(facility_id=fid):
                        resp = client.get(
                            f"/api/v1/public-facilities/{fid}/environmental/current",
                            params={"metrics": metrics_query},
                        )
                        self.assertEqual(resp.status_code, 200)
                        data = resp.json()
                        self.assertEqual(data["facilityId"], fid)
                        returned = {m["metric"]: m for m in data["metrics"]}

                        for m_key in standard_metrics:
                            self.assertIn(m_key, returned, f"Facility {fid} missing metric {m_key}")
                            m_obj = returned[m_key]
                            self.assertEqual(
                                m_obj["availability"],
                                "AVAILABLE",
                                f"Facility {fid} metric {m_key} has status {m_obj['availability']} (expected AVAILABLE)",
                            )
                            self.assertIsNotNone(
                                m_obj["value"],
                                f"Facility {fid} metric {m_key} has None value",
                            )
                            self.assertIsNotNone(
                                m_obj["station"],
                                f"Facility {fid} metric {m_key} has no station metadata",
                            )
                            self.assertGreaterEqual(
                                m_obj["station"]["distanceKm"],
                                0.0,
                                f"Facility {fid} metric {m_key} has negative distance",
                            )
            finally:
                engine.dispose()

    def test_all_nineteen_facilities_time_series_ranges_return_populated_points(self):
        """Verify that for all 19 facilities, each time-series range tab (24h, 7d, 30d, 90d, 1y)
        returns populated series points without empty states for standard metrics."""
        standard_metrics = [
            "aqi",
            "pm25",
            "pm10",
            "temperature",
            "relative_humidity",
            "rainfall",
            "groundwater_depth",
        ]
        ranges = ["24h", "7d", "30d", "90d", "1y"]

        with tempfile.TemporaryDirectory() as directory:
            copied = Path(directory) / "ecosite-copy.db"
            shutil.copy2(DB_PATH, copied)
            engine = make_engine(copied)
            try:
                repository = SqlAlchemyEnvironmentalRepository(
                    lambda: Session(engine, expire_on_commit=False),
                    clock=lambda: NOW,
                )
                app = FastAPI()
                app.state.environmental_monitoring_service = EnvironmentalMonitoringService(
                    repository,
                    clock=lambda: NOW,
                )
                app.include_router(router, prefix="/api/v1")
                client = TestClient(app)

                facilities = [
                    r[0]
                    for r in engine.connect()
                    .execute(__import__("sqlalchemy").text("SELECT id FROM public_facilities ORDER BY id"))
                    .fetchall()
                ]

                metrics_query = ",".join(standard_metrics)
                for fid in facilities:
                    for r_key in ranges:
                        with self.subTest(facility_id=fid, range=r_key):
                            resp = client.get(
                                f"/api/v1/public-facilities/{fid}/environmental",
                                params={"metrics": metrics_query, "range": r_key, "interval": "auto"},
                            )
                            self.assertEqual(resp.status_code, 200)
                            data = resp.json()
                            self.assertEqual(data["facilityId"], fid)
                            self.assertEqual(data["range"], r_key)
                            series_list = data.get("series", [])
                            self.assertEqual(len(series_list), len(standard_metrics))

                            for series in series_list:
                                self.assertEqual(
                                    series["availability"],
                                    "AVAILABLE",
                                    f"Facility {fid} metric {series['metric']} range {r_key} availability {series['availability']}",
                                )
                                points = series.get("points", [])
                                self.assertGreater(
                                    len(points),
                                    0,
                                    f"Facility {fid} metric {series['metric']} range {r_key} returned 0 points (empty state)",
                                )
                                populated_points = [p for p in points if p.get("value") is not None]
                                self.assertGreater(
                                    len(populated_points),
                                    0,
                                    f"Facility {fid} metric {series['metric']} range {r_key} has no non-null values",
                                )
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()

