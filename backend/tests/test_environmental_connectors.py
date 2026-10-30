import io
import json
import os
import sqlite3
import tempfile
import unittest
import zipfile
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import numpy as np

try:
    import rasterio
    from rasterio.transform import from_bounds
    HAS_RASTERIO = True
except ImportError:
    rasterio = None
    from_bounds = None
    HAS_RASTERIO = False

from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.app import db, main as api
from backend.app.data.connectors import CONNECTORS
from backend.app.data.connectors.base import ConnectorUnavailable, FetchRequest, ParsedRecord, RawPayload
from backend.app.data.connectors.copernicus_stac import CopernicusStacConnector
from backend.app.data.connectors.jrc_gsw import JrcGswConnector, _tile_origins as jrc_tiles
from backend.app.data.connectors.srtm import SrtmGl1Connector, _tile_origins as srtm_tiles
from backend.app.data.connectors.nasa_power import NasaPowerConnector
from backend.app.data.ingest import run_ingestion
from backend.app.data.models import DataSource, IngestionRun, Observation, RawSnapshot
from backend.app.data.registry import seed_data_sources
from backend.app.routers import environmental
from backend.tests.test_projects import migration_config

PUNE = {
    "type": "Polygon",
    "coordinates": [
        [[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]
    ],
}


def geotiff_bytes(values, bounds=(73.80, 18.45, 73.90, 18.60), nodata=255):
    if not HAS_RASTERIO:
        raise unittest.SkipTest("rasterio is not installed")
    buffer = io.BytesIO()
    height, width = values.shape
    with rasterio.MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            height=height,
            width=width,
            count=1,
            dtype=values.dtype,
            crs="EPSG:4326",
            transform=from_bounds(*bounds, width, height),
            nodata=nodata,
        ) as dataset:
            dataset.write(values, 1)
        return memory.read()


def hgt_zip_bytes(tile="N18E073", size=1201, void_slice=None):
    rows = np.linspace(600, 500, size, dtype=np.float64)
    array = np.tile(rows[:, None], (1, size)).astype(">i2")
    if void_slice is not None:
        array[void_slice] = -32768
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"{tile}.hgt", array.tobytes())
    return buffer.getvalue()


def payload(source_id, filename, content, content_type, metadata=None):
    return RawPayload(
        source_id=source_id,
        url=f"fixture://{filename}",
        content=content,
        content_type=content_type,
        http_status=200,
        fetched_at="2026-10-27T00:00:00Z",
        filename=filename,
        dataset_version="fixture",
        is_live=False,
        metadata=metadata or {},
    )


def request(buffer_m=500.0, max_tiles=4):
    return FetchRequest(geometry=PUNE, geometry_hash="a" * 64, buffer_m=buffer_m, max_tiles=max_tiles)


def stac_feature(scene_id, moment, cloud):
    return {
        "type": "Feature",
        "id": scene_id,
        "properties": {"datetime": moment, "eo:cloud_cover": cloud, "platform": "sentinel-2a"},
        "geometry": None,
    }


def stac_bytes(features, next_link=None):
    document = {"type": "FeatureCollection", "features": features, "links": []}
    if next_link is not None:
        document["links"].append(next_link)
    return json.dumps(document).encode("utf-8")


class JrcConnectorTests(unittest.TestCase):
    @unittest.skipUnless(HAS_RASTERIO, "rasterio is not installed")
    def test_occurrence_overlap_mean_max_and_proximity(self):
        values = np.zeros((200, 200), dtype=np.uint8)
        values[80:120, 80:120] = 100
        values[0:5, 0:5] = 255  # nodata outside the polygon
        records = JrcGswConnector().parse(
            [payload("jrc_gsw", "occurrence_70E_10N_v1_5_2024.tif", geotiff_bytes(values), "image/tiff")],
            request(),
        )
        by_id = {record.indicator: record for record in records}
        self.assertEqual(by_id["historical_water_occurrence_overlap_fraction"].value, 1.0)
        self.assertEqual(by_id["historical_water_occurrence_mean_percent"].value, 100.0)
        self.assertEqual(by_id["historical_water_occurrence_max_percent"].value, 100.0)
        self.assertEqual(by_id["historical_water_valid_pixel_fraction"].value, 1.0)
        self.assertEqual(by_id["nearest_mapped_water_distance_m"].value, 0.0)
        self.assertEqual(by_id["historical_water_valid_pixel_fraction"].status, "AVAILABLE")
        self.assertEqual(by_id["historical_water_valid_pixel_fraction"].evidence_class, "REMOTE_SENSING_DERIVED")
        self.assertEqual(by_id["historical_water_valid_pixel_fraction"].coverage_fraction, 1.0)

    @unittest.skipUnless(HAS_RASTERIO, "rasterio is not installed")
    def test_no_water_keeps_proximity_missing_instead_of_zero(self):
        values = np.zeros((200, 200), dtype=np.uint8)
        records = JrcGswConnector().parse(
            [payload("jrc_gsw", "occurrence_70E_10N_v1_5_2024.tif", geotiff_bytes(values), "image/tiff")],
            request(),
        )
        by_id = {record.indicator: record for record in records}
        self.assertEqual(by_id["historical_water_occurrence_overlap_fraction"].value, 0.0)
        proximity = by_id["nearest_mapped_water_distance_m"]
        self.assertIsNone(proximity.value)
        self.assertEqual(proximity.status, "PARTIAL")
        self.assertIn("No mapped surface-water pixel", proximity.missing_reason)

    @unittest.skipUnless(HAS_RASTERIO, "rasterio is not installed")
    def test_nodata_only_polygon_is_source_unavailable(self):
        values = np.full((200, 200), 255, dtype=np.uint8)
        records = JrcGswConnector().parse(
            [payload("jrc_gsw", "occurrence_70E_10N_v1_5_2024.tif", geotiff_bytes(values), "image/tiff")],
            request(),
        )
        self.assertTrue(all(record.status == "SOURCE_UNAVAILABLE" for record in records))
        values = {record.indicator: record.value for record in records}
        self.assertEqual(values.pop("historical_water_valid_pixel_fraction"), 0.0)
        self.assertTrue(all(value is None for value in values.values()))
        self.assertTrue(all(record.missing_reason for record in records))

    def test_tile_selection_uses_only_intersecting_tiles(self):
        self.assertEqual(jrc_tiles(PUNE, 4), [(70, 20)])
        spanning = {
            "type": "Polygon",
            "coordinates": [[[69.5, 9.5], [70.5, 9.5], [70.5, 10.5], [69.5, 10.5], [69.5, 9.5]]],
        }
        self.assertEqual(
            sorted(jrc_tiles(spanning, 4)),
            [(60, 10), (60, 20), (70, 10), (70, 20)],
        )
        with self.assertRaises(ConnectorUnavailable):
            jrc_tiles(spanning, 2)


class SrtmConnectorTests(unittest.TestCase):
    @unittest.skipUnless(HAS_RASTERIO, "rasterio is not installed")
    def test_terrain_statistics_and_void_fraction(self):
        # The void block sits inside the Pune polygon (rows ~564-588, cols ~1008-1032).
        content = hgt_zip_bytes(void_slice=(np.s_[570:578, 1012:1020]))
        records = SrtmGl1Connector().parse(
            [payload("nasa_srtmgl1", "N18E073.SRTMGL1.hgt.zip", content, "application/zip")],
            request(),
        )
        by_id = {record.indicator: record for record in records}
        self.assertAlmostEqual(by_id["terrain_elevation_mean_m"].value, 551.5, delta=2.0)
        self.assertGreater(by_id["terrain_relief_m"].value, 0)
        self.assertGreater(by_id["terrain_slope_mean_deg"].value, 0)
        self.assertGreater(by_id["terrain_void_pixel_fraction"].value, 0.05)
        self.assertEqual(by_id["terrain_elevation_mean_m"].status, "PARTIAL")
        self.assertEqual(by_id["terrain_elevation_mean_m"].unit, "m")

    def test_tile_selection_and_limit(self):
        self.assertEqual(srtm_tiles(PUNE, 4), [(18, 73)])
        spanning = {
            "type": "Polygon",
            "coordinates": [[[72.5, 17.5], [73.5, 17.5], [73.5, 18.5], [72.5, 18.5], [72.5, 17.5]]],
        }
        self.assertEqual(sorted(srtm_tiles(spanning, 4)), [(17, 72), (17, 73), (18, 72), (18, 73)])
        with self.assertRaises(ConnectorUnavailable):
            srtm_tiles(spanning, 2)

    def test_fetch_requires_earthdata_token(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ConnectorUnavailable) as caught:
                SrtmGl1Connector().fetch(request())
        self.assertIn("ECOSITE_EARTHDATA_TOKEN", str(caught.exception))

    def test_invalid_zip_is_rejected(self):
        with self.assertRaises(ConnectorUnavailable):
            SrtmGl1Connector().parse(
                [payload("nasa_srtmgl1", "N18E073.SRTMGL1.hgt.zip", b"not a zip", "application/zip")],
                request(),
            )


class StacConnectorTests(unittest.TestCase):
    def parse_features(self, features, next_link=None, payloads=None):
        pages = payloads or [
            payload(
                "copernicus_stac",
                "stac-search-01.json",
                stac_bytes(features, next_link),
                "application/geo+json",
            )
        ]
        return {
            record.indicator: record
            for record in CopernicusStacConnector().parse(pages, request())
        }

    def test_scene_summary_and_usable_fraction(self):
        features = [
            stac_feature("scene-a", "2026-10-01T05:00:00Z", 5.0),
            stac_feature("scene-b", "2026-10-10T05:00:00Z", 10.0),
            stac_feature("scene-c", "2026-10-20T05:00:00Z", 25.0),
            stac_feature("scene-d", "2026-10-25T05:00:00Z", 60.0),
        ]
        with patch.dict(os.environ, {"ECOSITE_STAC_MAX_CLOUD": "20"}, clear=False):
            by_id = self.parse_features(features)

        self.assertEqual(by_id["sentinel2_scene_count"].value, 4.0)
        self.assertEqual(by_id["sentinel2_scene_count"].status, "AVAILABLE")
        self.assertEqual(by_id["sentinel2_usable_scene_count"].value, 2.0)
        self.assertEqual(by_id["sentinel2_usable_scene_fraction"].value, 0.5)
        self.assertEqual(by_id["sentinel2_cloud_cover_median_percent"].value, 17.5)
        self.assertEqual(by_id["sentinel2_cloud_cover_min_percent"].value, 5.0)
        self.assertAlmostEqual(by_id["sentinel2_latest_scene_age_days"].value, 43 / 24)
        self.assertEqual(by_id["sentinel2_scene_date_span_days"].value, 24.0)
        self.assertEqual(by_id["sentinel2_scene_count"].period_start, "2026-10-01")
        self.assertEqual(by_id["sentinel2_scene_count"].period_end, "2026-10-25")
        self.assertEqual(by_id["sentinel2_scene_count"].observed_at, "2026-10-25T05:00:00+00:00")
        self.assertIsNone(by_id["sentinel2_scene_count"].coverage_fraction)
        self.assertFalse(by_id["sentinel2_scene_count"].quality_flags["server_cloud_filter"])
        self.assertIn("pixel NDVI is reported separately", by_id["sentinel2_scene_count"].quality_flags["note"])

    def test_no_scenes_is_zero_and_not_missing(self):
        by_id = self.parse_features([])
        self.assertEqual(by_id["sentinel2_scene_count"].value, 0.0)
        self.assertEqual(by_id["sentinel2_scene_count"].status, "AVAILABLE")
        self.assertIsNone(by_id["sentinel2_usable_scene_count"].value)
        self.assertEqual(by_id["sentinel2_usable_scene_count"].status, "SOURCE_UNAVAILABLE")
        self.assertIn("No Sentinel-2 L2A scenes", by_id["sentinel2_usable_scene_count"].missing_reason)
        self.assertIsNone(by_id["sentinel2_cloud_cover_median_percent"].value)
        self.assertEqual(by_id["sentinel2_cloud_cover_median_percent"].status, "SOURCE_UNAVAILABLE")
        self.assertIsNone(by_id["sentinel2_latest_scene_age_days"].value)
        self.assertEqual(by_id["sentinel2_latest_scene_age_days"].status, "PARTIAL")

    def test_zero_scene_result_records_search_window(self):
        page = payload(
            "copernicus_stac",
            "stac-search-01.json",
            stac_bytes([]),
            "application/geo+json",
            metadata={
                "search_datetime": "2025-10-28T00:00:00Z/2026-10-27T23:59:59Z",
                "search_url": "https://example.test/stac/search",
                "lookback_days": 364,
            },
        )
        by_id = self.parse_features([], payloads=[page])
        record = by_id["sentinel2_scene_count"]
        self.assertEqual(record.value, 0.0)
        self.assertEqual(record.status, "AVAILABLE")
        # The absence of scenes is tied to the exact window, not to a missing date.
        self.assertEqual(record.period_start, "2025-10-28")
        self.assertEqual(record.period_end, "2026-10-27")
        self.assertIsNone(record.observed_at)
        self.assertEqual(record.quality_flags["search_datetime"], "2025-10-28T00:00:00Z/2026-10-27T23:59:59Z")
        self.assertEqual(record.quality_flags["search_url"], "https://example.test/stac/search")
        self.assertEqual(record.quality_flags["lookback_days"], 364)

    def test_scene_dates_take_precedence_over_search_window(self):
        page = payload(
            "copernicus_stac",
            "stac-search-01.json",
            stac_bytes([stac_feature("scene-a", "2026-10-20T05:00:00Z", 5.0)]),
            "application/geo+json",
            metadata={"search_datetime": "2025-10-28T00:00:00Z/2026-10-27T23:59:59Z"},
        )
        by_id = self.parse_features([], payloads=[page])
        record = by_id["sentinel2_scene_count"]
        self.assertEqual(record.period_start, "2026-10-20")
        self.assertEqual(record.period_end, "2026-10-20")
        self.assertEqual(record.observed_at, "2026-10-20T05:00:00+00:00")

    def test_missing_cloud_cover_is_partial_not_zero(self):
        by_id = self.parse_features([stac_feature("scene-a", "2026-10-25T05:00:00Z", None)])
        self.assertEqual(by_id["sentinel2_scene_count"].value, 1.0)
        self.assertIsNone(by_id["sentinel2_usable_scene_count"].value)
        self.assertEqual(by_id["sentinel2_usable_scene_count"].status, "PARTIAL")
        self.assertIn("eo:cloud_cover", by_id["sentinel2_usable_scene_count"].missing_reason)
        self.assertIsNone(by_id["sentinel2_cloud_cover_min_percent"].value)
        self.assertEqual(by_id["sentinel2_cloud_cover_min_percent"].status, "PARTIAL")
        self.assertEqual(by_id["sentinel2_scene_count"].quality_flags["scenes_without_cloud_cover"], 1)

    def test_pagination_deduplicates_scenes(self):
        first = payload(
            "copernicus_stac",
            "stac-search-01.json",
            stac_bytes([stac_feature("scene-a", "2026-10-01T05:00:00Z", 5.0)]),
            "application/geo+json",
        )
        second = payload(
            "copernicus_stac",
            "stac-search-02.json",
            stac_bytes(
                [
                    stac_feature("scene-a", "2026-10-01T05:00:00Z", 5.0),
                    stac_feature("scene-b", "2026-10-02T05:00:00Z", 10.0),
                ]
            ),
            "application/geo+json",
        )
        by_id = self.parse_features([], payloads=[first, second])
        self.assertEqual(by_id["sentinel2_scene_count"].value, 2.0)
        self.assertEqual(by_id["sentinel2_scene_count"].quality_flags["pages"], 2)

    def test_fetch_follows_next_link(self):
        page_one = stac_bytes(
            [stac_feature("scene-a", "2026-10-01T05:00:00Z", 5.0)],
            {
                "rel": "next",
                "method": "POST",
                "href": "https://stac.example.test/v1/search",
                "body": {"collections": ["sentinel-2-l2a"], "token": "next-token"},
            },
        )
        page_two = stac_bytes([stac_feature("scene-b", "2026-10-02T05:00:00Z", 10.0)])
        calls = []

        def fake_post(url, body, timeout_s):
            calls.append((url, body))
            return (page_one if len(calls) == 1 else page_two), "application/geo+json", 200

        with patch("backend.app.data.connectors.copernicus_stac.http_post_json", side_effect=fake_post):
            # Pagination is the subject here; the pixel stage is covered separately.
            with patch.dict(os.environ, {"ECOSITE_S2_NDVI": "0", "ECOSITE_STAC_SEARCH_URL": "https://stac.opensearch.dataspace.copernicus.eu/v1/search"}, clear=False):
                payloads = CopernicusStacConnector().fetch(request())

        self.assertEqual(len(payloads), 2)
        self.assertEqual(calls[0][0], "https://stac.opensearch.dataspace.copernicus.eu/v1/search")
        self.assertEqual(calls[1][0], "https://stac.example.test/v1/search")
        self.assertEqual(calls[1][1]["token"], "next-token")
        self.assertEqual(payloads[0].filename, "stac-search-01.json")
        self.assertEqual(payloads[1].filename, "stac-search-02.json")
        # Every page carries the exact window that produced the search, so a
        # zero-scene result stays reproducible after pagination.
        for page in payloads:
            self.assertEqual(page.metadata["search_url"], "https://stac.opensearch.dataspace.copernicus.eu/v1/search")
            self.assertEqual(page.metadata["lookback_days"], 365)
            start, _, end = page.metadata["search_datetime"].partition("/")
            self.assertTrue(start.endswith("T00:00:00Z"))
            self.assertTrue(end.endswith("T23:59:59Z"))
            self.assertEqual(page.metadata["search_datetime"], payloads[0].metadata["search_datetime"])

    def test_connector_is_registered(self):
        self.assertIn("copernicus_stac", CONNECTORS)
        self.assertEqual(CONNECTORS["copernicus_stac"].source_id, "copernicus_stac")


@unittest.skipUnless(HAS_RASTERIO, "rasterio is not installed")
class Sentinel2NdviTests(unittest.TestCase):
    """Pixel NDVI: cloud masking, coverage and explicit missing values."""

    def band_payloads(self, values, scl, scene_id="S2B_TEST_20240129_0_L2A", cloud=0.5, error=None):
        geometry = PUNE
        height, width = values.shape
        transform = from_bounds(73.80, 18.45, 73.90, 18.60, width, height)
        search = payload(
            "copernicus_stac",
            "cog-search-01.json",
            json.dumps({"type": "FeatureCollection", "features": []}).encode("utf-8"),
            "application/json",
            metadata={
                "role": "cog_search",
                "geometry": geometry,
                **({"ndvi_error": error} if error else {}),
            },
        )
        if error:
            return [search]
        bands = [
            (
                "red",
                values.astype("uint16"),
            ),
            (
                "nir",
                values.astype("uint16") * 3,
            ),
            ("scl", scl.astype("uint8")),
        ]
        pages = [search]
        for name, array in bands:
            from backend.app.data.connectors import sentinel2_ndvi as ndvi

            pages.append(
                payload(
                    "copernicus_stac",
                    f"ndvi-{scene_id}-{name}.tif",
                    ndvi.window_geotiff_bytes(array, transform, "EPSG:4326"),
                    "image/tiff",
                    metadata={
                        "role": "ndvi_band",
                        "band": name,
                        "scene_id": scene_id,
                        "scene_datetime": "2024-01-29T05:30:59+00:00",
                        "period_start": "2024-01-29",
                        "scene_cloud_cover": cloud,
                    },
                )
            )
        return pages

    def test_cloud_masked_median_and_coverage(self):
        # Red 1000, NIR 3000 -> NDVI 0.5 on every kept pixel. Three quarters of
        # the polygon is cloud, so coverage is 0.25 and the run is PARTIAL.
        scl = np.full((40, 40), 4, dtype=np.uint8)
        scl[:, 18:] = 9  # the polygon spans columns ~16-23; cloud covers all but the first quarter
        values = np.full((40, 40), 1000, dtype=np.uint16)
        records = CopernicusStacConnector().parse(self.band_payloads(values, scl), request())
        by_id = {record.indicator: record for record in records}

        median = by_id["sentinel2_ndvi_median"]
        self.assertAlmostEqual(median.value, 0.5, places=4)
        self.assertEqual(median.unit, "index")
        self.assertEqual(median.status, "PARTIAL")
        self.assertAlmostEqual(median.coverage_fraction, 0.25, places=3)
        self.assertIn("Less than half", median.missing_reason)
        self.assertEqual(median.evidence_class, "REMOTE_SENSING_DERIVED")
        self.assertEqual(median.quality_flags["scene_id"], "S2B_TEST_20240129_0_L2A")
        self.assertEqual(median.observed_at, "2024-01-29T05:30:59+00:00")
        self.assertEqual(median.period_start, "2024-01-29")

        self.assertAlmostEqual(by_id["sentinel2_ndvi_valid_pixel_fraction"].value, 0.25, places=3)
        self.assertAlmostEqual(by_id["sentinel2_ndvi_cloud_masked_fraction"].value, 0.75, places=3)

    def test_fully_clear_polygon_is_available(self):
        scl = np.full((40, 40), 5, dtype=np.uint8)  # bare soil, kept
        values = np.full((40, 40), 800, dtype=np.uint16)
        records = CopernicusStacConnector().parse(self.band_payloads(values, scl), request())
        by_id = {record.indicator: record for record in records}
        median = by_id["sentinel2_ndvi_median"]
        self.assertEqual(median.status, "AVAILABLE")
        self.assertIsNone(median.missing_reason)
        self.assertAlmostEqual(median.coverage_fraction, 1.0, places=6)

    def test_cloud_only_polygon_is_unavailable_never_zero(self):
        scl = np.full((40, 40), 9, dtype=np.uint8)
        values = np.full((40, 40), 1000, dtype=np.uint16)
        records = CopernicusStacConnector().parse(self.band_payloads(values, scl), request())
        by_id = {record.indicator: record for record in records}
        median = by_id["sentinel2_ndvi_median"]
        self.assertIsNone(median.value)
        self.assertEqual(median.status, "SOURCE_UNAVAILABLE")
        self.assertIn("No cloud-free vegetation", median.missing_reason)

    def test_pixel_failure_reason_reaches_the_records(self):
        pages = self.band_payloads(
            np.zeros((4, 4), dtype=np.uint16),
            np.zeros((4, 4), dtype=np.uint8),
            error="Sentinel-2 COG scene search failed: HTTP 503",
        )
        by_id = {
            record.indicator: record
            for record in CopernicusStacConnector().parse(pages, request())
        }
        for indicator in (
            "sentinel2_ndvi_median",
            "sentinel2_ndvi_valid_pixel_fraction",
            "sentinel2_ndvi_cloud_masked_fraction",
        ):
            self.assertIsNone(by_id[indicator].value)
            self.assertEqual(by_id[indicator].status, "SOURCE_UNAVAILABLE")
            self.assertIn("HTTP 503", by_id[indicator].missing_reason)

    def test_metadata_survives_a_failed_pixel_stage(self):
        pages = [
            payload(
                "copernicus_stac",
                "stac-search-01.json",
                stac_bytes([stac_feature("scene-a", "2026-10-20T05:00:00Z", 5.0)]),
                "application/geo+json",
            )
        ] + self.band_payloads(
            np.zeros((4, 4), dtype=np.uint16),
            np.zeros((4, 4), dtype=np.uint8),
            error="tile unavailable",
        )
        records = CopernicusStacConnector().parse(pages, request())
        by_id = {record.indicator: record for record in records}
        self.assertEqual(by_id["sentinel2_scene_count"].value, 1.0)
        self.assertEqual(by_id["sentinel2_scene_count"].status, "AVAILABLE")
        self.assertEqual(by_id["sentinel2_ndvi_median"].status, "SOURCE_UNAVAILABLE")

    def test_disabled_pixel_stage_is_labelled(self):
        pages = [
            payload(
                "copernicus_stac",
                "stac-search-01.json",
                stac_bytes([stac_feature("scene-a", "2026-10-20T05:00:00Z", 5.0)]),
                "application/geo+json",
            )
        ]
        with patch.dict(os.environ, {"ECOSITE_S2_NDVI": "0"}, clear=False):
            by_id = {
                record.indicator: record
                for record in CopernicusStacConnector().parse(pages, request())
            }
        self.assertEqual(by_id["sentinel2_ndvi_median"].status, "SOURCE_UNAVAILABLE")
        self.assertIn("ECOSITE_S2_NDVI", by_id["sentinel2_ndvi_median"].missing_reason)

    def test_utm_raster_is_masked_with_the_reprojected_polygon(self):
        """Regression: a UTM window with a lon/lat mask selected nothing."""
        from pyproj import Transformer

        from backend.app.data.connectors import sentinel2_ndvi as ndvi

        transformer = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True)
        xs, ys = transformer.transform([73.80, 73.90], [18.45, 18.60])
        transform = from_bounds(min(xs), min(ys), max(xs), max(ys), 60, 60)
        red = np.full((60, 60), 1000, dtype="uint16")
        nir = np.full((60, 60), 3000, dtype="uint16")
        scl = np.full((60, 60), 4, dtype="uint8")
        stats = ndvi.ndvi_statistics(red, nir, scl, transform, PUNE, crs="EPSG:32643")
        self.assertGreater(stats["inside_pixels"], 0)
        self.assertAlmostEqual(stats["coverage_fraction"], 1.0, places=6)
        self.assertAlmostEqual(stats["ndvi_median"], 0.5, places=4)

    def test_scene_choice_prefers_clear_sky_and_requires_scl(self):
        from backend.app.data.connectors import sentinel2_ndvi as ndvi

        assets = {
            name: {"href": f"https://example.test/{name}.tif"} for name in ndvi.REQUIRED_ASSETS
        }
        usable = lambda scene_id, cloud, moment: {
            "id": scene_id,
            "properties": {"datetime": moment, "eo:cloud_cover": cloud},
            "assets": dict(assets),
        }
        no_scl = usable("no-scl", 0.0, "2024-01-30T05:00:00Z")
        no_scl["assets"].pop("scl")
        chosen = ndvi.pick_scene(
            [
                no_scl,
                usable("cloudy", 40.0, "2024-01-20T05:00:00Z"),
                usable("clear-old", 1.0, "2024-01-10T05:00:00Z"),
                usable("clear-new", 1.0, "2024-01-25T05:00:00Z"),
            ]
        )
        self.assertEqual(chosen["id"], "clear-new")
        self.assertIsNone(ndvi.pick_scene([no_scl]))


class FakeConnector:
    parser_version = "test"

    def __init__(self, source_id, status="AVAILABLE"):
        self.source_id = source_id
        self.status = status

    def fetch(self, request):
        return [payload(self.source_id, f"{self.source_id}.bin", b"fixture", "application/octet-stream")]

    def parse(self, payloads, request):
        return [
            ParsedRecord(
                indicator=f"{self.source_id}_indicator",
                value=1.0,
                unit="fraction",
                status=self.status,
                evidence_class="REMOTE_SENSING_DERIVED",
                dataset_version="fixture v1",
                period_start="2020-01-01",
                period_end="2020-12-31",
                observed_at=None,
                published_at=None,
                resolution="30 m",
                method="fixture",
                processing_version="test",
                coverage_fraction=1.0,
                quality_flags={},
            )
        ]


class RecordingConnector(FakeConnector):
    def __init__(self, source_id):
        super().__init__(source_id)
        self.requests = []

    def fetch(self, request):
        self.requests.append(request)
        return super().fetch(request)


class BrokenConnector:
    parser_version = "test"
    source_id = "jrc_gsw"

    def fetch(self, request):
        raise ConnectorUnavailable("fixture source is down")

    def parse(self, payloads, request):
        raise AssertionError("parse must not run after a failed fetch")


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "ingest.db"
        self.raw = Path(self.temp) / "raw"
        command.upgrade(migration_config(self.path), "head")
        with closing(sqlite3.connect(self.path)) as connection, connection:
            seed_data_sources(connection)

    def test_success_is_idempotent_and_advances_maturity(self):
        with db.project_session(self.path) as session:
            first = run_ingestion(session, "jrc_gsw", request(), connector=FakeConnector("jrc_gsw"), raw_dir=self.raw)
            second = run_ingestion(session, "jrc_gsw", request(), connector=FakeConnector("jrc_gsw"), raw_dir=self.raw)
            self.assertEqual(first.status, "success")
            self.assertEqual(second.status, "success")
            self.assertEqual(first.observation_ids, second.observation_ids)
            self.assertEqual(session.scalar(select(func.count()).select_from(Observation)), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(RawSnapshot)), 2)
            source = session.get(DataSource, "jrc_gsw")
            self.assertEqual(source.runtime_status, "CONNECTED")
            self.assertEqual(source.test_status, "PROCESSING_TESTED")
            self.assertIsNotNone(source.last_success_at)
        self.assertEqual(len(list(self.raw.rglob("*.gz"))), 2)

    def test_failure_is_recorded_and_marks_source_unavailable(self):
        with db.project_session(self.path) as session:
            result = run_ingestion(session, "jrc_gsw", request(), connector=BrokenConnector(), raw_dir=self.raw)
            self.assertEqual(result.status, "failed")
            self.assertIn("fixture source is down", result.error)
            run = session.get(IngestionRun, result.run_id)
            self.assertEqual(run.status, "failed")
            self.assertEqual(run.error, "fixture source is down")
            source = session.get(DataSource, "jrc_gsw")
            self.assertEqual(source.runtime_status, "SOURCE_UNAVAILABLE")
            # A transient failure does not erase an earlier processing verification.
            self.assertEqual(source.test_status, "PROCESSING_TESTED")
            self.assertEqual(session.scalar(select(func.count()).select_from(Observation)), 0)

    def test_unavailable_observation_is_partial_not_a_fake_value(self):
        with db.project_session(self.path) as session:
            result = run_ingestion(
                session,
                "jrc_gsw",
                request(),
                connector=FakeConnector("jrc_gsw", status="PARTIAL"),
                raw_dir=self.raw,
            )
            self.assertEqual(result.status, "partial")
            self.assertEqual(session.scalar(select(func.count()).select_from(Observation)), 1)


class EnvironmentalApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "api.db"
        self.boundary = Path(self.temp) / "boundary.json"
        self.boundary.write_text(
            '{"type":"Polygon","coordinates":[[[72,17],[76,17],[76,21],[72,21],[72,17]]]}',
            encoding="utf-8",
        )
        import hashlib

        self.enterContext(
            patch.dict(
                os.environ,
                {
                    "ECOSITE_INDIA_BOUNDARY_PATH": str(self.boundary),
                    "ECOSITE_INDIA_BOUNDARY_SHA256": hashlib.sha256(self.boundary.read_bytes()).hexdigest(),
                    "ECOSITE_INDIA_BOUNDARY_SOURCE": "Synthetic TEST boundary only; not an India dataset",
                },
            )
        )
        self.enterContext(patch.object(api, "DB_PATH", self.path))
        self.enterContext(patch.object(db, "DB_PATH", self.path))
        command.upgrade(migration_config(self.path), "head")
        with closing(sqlite3.connect(self.path)) as connection, connection:
            seed_data_sources(connection)

        async def local_app(scope, receive, send):
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)

        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))
        project = self.client.post(
            "/api/v1/projects",
            json={"name": "Connector test", "organization_label": "EcoSite", "archetype": "edge"},
        ).json()
        response = self.client.post(
            f"/api/v1/projects/{project['id']}/sites",
            json={"name": "Pune candidate", "geometry": PUNE, "state_code": "IN-MH", "district": "Pune"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.site = response.json()
        self.enterContext(
            patch.object(
                environmental,
                "CONNECTORS",
                {
                    "jrc_gsw": FakeConnector("jrc_gsw"),
                    "nasa_srtmgl1": FakeConnector("nasa_srtmgl1"),
                    "copernicus_stac": FakeConnector("copernicus_stac"),
                },
            )
        )

    def test_analysis_stores_observations_and_returns_them(self):
        response = self.client.post(
            f"/api/v1/sites/{self.site['id']}/environmental-analysis",
            json={"sources": ["jrc_gsw"], "buffer_m": 500},
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["results"][0]["status"], "success")
        self.assertEqual(body["results"][0]["observation_count"], 1)
        self.assertEqual(len(body["observations"]), 1)
        listed = self.client.get(f"/api/v1/sites/{self.site['id']}/observations").json()
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["source_id"], "jrc_gsw")
        self.assertEqual(
            self.client.get(
                f"/api/v1/sites/{self.site['id']}/observations?source_id=nasa_srtmgl1"
            ).json()["total"],
            0,
        )

    def test_stac_source_is_routed_with_max_pages(self):
        connector = RecordingConnector("copernicus_stac")
        with patch.object(environmental, "CONNECTORS", {"copernicus_stac": connector}):
            response = self.client.post(
                f"/api/v1/sites/{self.site['id']}/environmental-analysis",
                json={"sources": ["copernicus_stac"], "max_pages": 2},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["results"][0]["source_id"], "copernicus_stac")
        self.assertEqual(connector.requests[0].max_pages, 2)

    def test_unimplemented_source_is_rejected(self):
        response = self.client.post(
            f"/api/v1/sites/{self.site['id']}/environmental-analysis",
            json={"sources": ["cgwb_assessment"]},
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"]["code"], "source_not_implemented")

    def test_all_sources_failing_returns_502_but_records_runs(self):
        with patch.object(
            environmental,
            "CONNECTORS",
            {"jrc_gsw": BrokenConnector()},
        ):
            response = self.client.post(
                f"/api/v1/sites/{self.site['id']}/environmental-analysis",
                json={"sources": ["jrc_gsw"]},
            )
        self.assertEqual(response.status_code, 502, response.text)
        self.assertEqual(response.json()["results"][0]["status"], "failed")
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM ingestion_runs").fetchone()[0], 1)
            self.assertEqual(
                connection.execute("SELECT runtime_status FROM data_sources WHERE id='jrc_gsw'").fetchone()[0],
                "SOURCE_UNAVAILABLE",
            )


class NasaPowerConnectorTests(unittest.TestCase):
    def test_connector_is_registered(self):
        self.assertIn("nasa_power", CONNECTORS)
        self.assertIsInstance(CONNECTORS["nasa_power"], NasaPowerConnector)

    def test_parse_daily_meteorology_and_cdd(self):
        payload_data = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [73.85, 18.52, 560.0]},
            "properties": {
                "parameter": {
                    "T2M": {"20260101": 22.0, "20260102": 26.0, "20260103": 17.0},
                    "T2M_MAX": {"20260101": 28.0, "20260102": 32.0, "20260103": 24.0},
                    "T2M_MIN": {"20260101": 16.0, "20260102": 18.0, "20260103": 12.0},
                    "RH2M": {"20260101": 55.0, "20260102": 60.0, "20260103": 65.0},
                    "ALLSKY_SFC_SW_DWN": {"20260101": 5.2, "20260102": 5.8, "20260103": 4.6},
                }
            },
        }
        raw = payload(
            "nasa_power",
            "nasa_power_daily.json",
            json.dumps(payload_data).encode("utf-8"),
            "application/json",
            metadata={"latitude": 18.52, "longitude": 73.85, "start": "20260101", "end": "20260103"},
        )
        records = {r.indicator: r for r in NasaPowerConnector().parse([raw], request())}

        # Indicators
        self.assertEqual(records["ambient_temperature_mean_c"].value, 21.67)
        self.assertEqual(records["ambient_temperature_max_c"].value, 32.0)
        self.assertEqual(records["ambient_temperature_min_c"].value, 12.0)
        self.assertEqual(records["relative_humidity_mean_percent"].value, 60.0)
        self.assertEqual(records["solar_ghi_annual_mean_kwh_per_sqm_day"].value, 5.2)
        # CDD: max(0, 22-18) + max(0, 26-18) + max(0, 17-18) = 4 + 8 + 0 = 12.0
        self.assertEqual(records["cooling_degree_days_cdd_base_18c"].value, 12.0)

        # Provenance
        for r in records.values():
            self.assertEqual(r.evidence_class, "MODELLED")
            self.assertEqual(r.dataset_version, "POWER v2.0 (MERRA-2)")
            self.assertEqual(r.period_start, "2026-01-01")
            self.assertEqual(r.period_end, "2026-01-03")

    def test_empty_or_nodata_series_returns_unavailable(self):
        payload_data = {
            "type": "Feature",
            "properties": {
                "parameter": {
                    "T2M": {"20260101": -999.0},
                    "T2M_MAX": {"20260101": -999.0},
                    "T2M_MIN": {"20260101": -999.0},
                    "RH2M": {"20260101": -999.0},
                    "ALLSKY_SFC_SW_DWN": {"20260101": -999.0},
                }
            },
        }
        raw = payload(
            "nasa_power",
            "nasa_power_daily.json",
            json.dumps(payload_data).encode("utf-8"),
            "application/json",
            metadata={"latitude": 18.52, "longitude": 73.85, "start": "20260101", "end": "20260101"},
        )
        records = {r.indicator: r for r in NasaPowerConnector().parse([raw], request())}
        for r in records.values():
            self.assertEqual(r.status, "SOURCE_UNAVAILABLE")
            self.assertIsNone(r.value)
            self.assertTrue(r.missing_reason)


if __name__ == "__main__":
    unittest.main()
