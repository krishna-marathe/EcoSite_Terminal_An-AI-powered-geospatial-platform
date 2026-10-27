"""JRC Global Surface Water (GSW) occurrence connector.

The connector downloads only the 10 x 10 degree tiles that intersect the
candidate polygon plus its buffer. It computes occurrence statistics for the
polygon itself and the distance to the nearest mapped water pixel inside the
buffer. It never downloads a national archive and never converts historical
occurrence into a flood probability.
"""
from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from typing import Any

from rasterio.io import MemoryFile

from .base import (
    ConnectorUnavailable,
    FetchRequest,
    ParsedRecord,
    RawPayload,
    http_get,
    validate_records,
)
from .raster import nearest_pixel_distance, read_zonal_window

SOURCE_ID = "jrc_gsw"
PARSER_VERSION = "1.0.0"
DATASET_VERSION = "GSW v1.5 (1984-2024)"
RESOLUTION = "30 m (Landsat-derived)"
METHOD = "zonal_occurrence_statistics"
EVIDENCE_CLASS = "REMOTE_SENSING_DERIVED"
PERIOD_START = "1984-01-01"
PERIOD_END = "2024-12-31"
DEFAULT_BASE_URL = (
    "https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/"
    "download2024/Aggregated/VER1-5/occurrence"
)
DEFAULT_WATER_THRESHOLD = 1.0
NODATA = 255


def _base_url() -> str:
    return os.getenv("ECOSITE_JRC_GSW_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _water_threshold() -> float:
    raw = os.getenv("ECOSITE_JRC_WATER_THRESHOLD", str(DEFAULT_WATER_THRESHOLD))
    try:
        threshold = float(raw)
    except ValueError as error:
        raise ConnectorUnavailable(f"ECOSITE_JRC_WATER_THRESHOLD is not a number: {raw!r}") from error
    if not 0 <= threshold <= 100:
        raise ConnectorUnavailable("ECOSITE_JRC_WATER_THRESHOLD must be between 0 and 100.")
    return threshold


def _tile_label(lon: int, lat: int) -> str:
    lon_label = f"{abs(lon)}E" if lon >= 0 else f"{abs(lon)}W"
    lat_label = f"{abs(lat)}N" if lat >= 0 else f"{abs(lat)}S"
    return f"{lon_label}_{lat_label}"


def _tile_origins(geometry: dict[str, Any], max_tiles: int) -> list[tuple[int, int]]:
    """Return (west_edge, north_edge) labels for the intersecting GSW tiles.

    JRC names each 10 x 10 degree tile by its west longitude and its **north**
    latitude. For example ``occurrence_70E_20N_v1_5_2024.tif`` covers
    70-80 E and 10-20 N. This differs from the usual south-west naming used by
    SRTM, so the two connectors keep separate tile helpers.
    """
    from shapely.geometry import shape

    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid:
        raise ConnectorUnavailable("Candidate polygon is invalid.")
    west, south, east, north = polygon.bounds
    if not all(math.isfinite(value) for value in (west, south, east, north)):
        raise ConnectorUnavailable("Candidate polygon bounds are not finite.")
    first_lon = math.floor(west / 10.0) * 10
    last_lon = math.floor((east - 1e-9) / 10.0) * 10
    first_lat = math.floor(south / 10.0) * 10 + 10
    last_lat = math.floor((north - 1e-9) / 10.0) * 10 + 10
    tiles = [
        (lon, lat)
        for lon in range(first_lon, last_lon + 10, 10)
        for lat in range(first_lat, last_lat + 10, 10)
    ]
    if not tiles:
        raise ConnectorUnavailable("Candidate polygon does not intersect a GSW tile.")
    if len(tiles) > max_tiles:
        raise ConnectorUnavailable(
            f"Candidate polygon intersects {len(tiles)} GSW tiles; the configured limit is {max_tiles}. "
            "Split the polygon or raise the limit deliberately."
        )
    return tiles


def _tile_url(lon: int, lat: int) -> str:
    label = _tile_label(lon, lat)
    return f"{_base_url()}/occurrence_{label}_v1_5_2024.tif"


def _open_raster(content: bytes):
    memory = MemoryFile(content)
    return memory, memory.open()


def _occurrence_records(
    *,
    valid_pixels: int,
    inside_pixels: int,
    wet_pixels: int,
    occurrence_sum: float,
    occurrence_max: float | None,
    nearest_m: float | None,
    threshold: float,
    buffer_m: float,
    tiles: list[str],
    tile_urls: list[str],
) -> list[ParsedRecord]:
    coverage = valid_pixels / inside_pixels if inside_pixels else 0.0
    if valid_pixels == 0:
        status = "SOURCE_UNAVAILABLE"
        reason = "No valid JRC GSW pixels inside the candidate polygon."
        overlap = None
        mean = None
    else:
        status = "PARTIAL" if coverage < 0.5 else "AVAILABLE"
        reason = None
        overlap = wet_pixels / valid_pixels
        mean = occurrence_sum / valid_pixels

    quality: dict[str, Any] = {
        "tiles": tiles,
        "tile_urls": tile_urls,
        "water_threshold_percent": threshold,
        "buffer_m": buffer_m,
        "inside_pixels": inside_pixels,
        "valid_pixels": valid_pixels,
        "wet_pixels": wet_pixels,
        "nodata_pixels": inside_pixels - valid_pixels,
    }

    def record(
        indicator: str,
        value: float | None,
        unit: str,
        missing_reason: str | None = None,
        status_override: str | None = None,
    ) -> ParsedRecord:
        return ParsedRecord(
            indicator=indicator,
            value=value,
            unit=unit,
            status=status_override or status,
            evidence_class=EVIDENCE_CLASS,
            dataset_version=DATASET_VERSION,
            period_start=PERIOD_START,
            period_end=PERIOD_END,
            observed_at=None,
            published_at=None,
            resolution=RESOLUTION,
            method=METHOD,
            processing_version=PARSER_VERSION,
            coverage_fraction=coverage,
            quality_flags=quality,
            missing_reason=missing_reason or reason,
        )

    proximity_reason = None
    proximity_status = None
    if nearest_m is None and valid_pixels:
        proximity_reason = (
            f"No mapped surface-water pixel at or above {threshold:g}% occurrence "
            f"within the {buffer_m:g} m buffer."
        )
        proximity_status = "PARTIAL"

    return [
        record("historical_water_occurrence_overlap_fraction", overlap, "fraction"),
        record("historical_water_occurrence_mean_percent", mean, "%"),
        record("historical_water_occurrence_max_percent", occurrence_max, "%"),
        record("historical_water_valid_pixel_fraction", coverage, "fraction"),
        record(
            "nearest_mapped_water_distance_m",
            nearest_m,
            "m",
            missing_reason=proximity_reason,
            status_override=proximity_status,
        ),
    ]


class JrcGswConnector:
    source_id = SOURCE_ID
    parser_version = PARSER_VERSION

    def fetch(self, request: FetchRequest) -> list[RawPayload]:
        fetched_at = datetime.now(timezone.utc).isoformat()
        payloads: list[RawPayload] = []
        for lon, lat in _tile_origins(request.geometry, request.max_tiles):
            label = _tile_label(lon, lat)
            url = _tile_url(lon, lat)
            content, content_type, status = http_get(url, timeout_s=request.timeout_s)
            payloads.append(
                RawPayload(
                    source_id=SOURCE_ID,
                    url=url,
                    content=content,
                    content_type=content_type,
                    http_status=status,
                    fetched_at=fetched_at,
                    filename=f"occurrence_{label}_v1_5_2024.tif",
                    dataset_version=DATASET_VERSION,
                )
            )
        return payloads

    def parse(self, payloads: list[RawPayload], request: FetchRequest) -> list[ParsedRecord]:
        threshold = _water_threshold()
        inside_total = 0
        valid_total = 0
        wet_total = 0
        occurrence_sum = 0.0
        occurrence_max: float | None = None
        nearest_m: float | None = None
        tiles: list[str] = []
        tile_urls: list[str] = []

        from shapely.geometry import shape

        polygon = shape(request.geometry)

        for payload in payloads:
            memory, src = _open_raster(payload.content)
            try:
                with src:
                    window = read_zonal_window(
                        src,
                        request.geometry,
                        request.buffer_m,
                        nodata=NODATA,
                    )
            finally:
                memory.close()

            tiles.append(payload.filename)
            tile_urls.append(payload.url)
            data = window.data
            valid_inside = window.inside & window.valid
            wet_inside = valid_inside & (data >= threshold)
            inside_total += int(window.inside.sum())
            valid_total += int(valid_inside.sum())
            wet_total += int(wet_inside.sum())
            if valid_inside.any():
                values = data[valid_inside].astype("float64")
                occurrence_sum += float(values.sum())
                tile_max = float(values.max())
                occurrence_max = tile_max if occurrence_max is None else max(occurrence_max, tile_max)

            wet_window = window.valid & (data >= threshold)
            distance = nearest_pixel_distance(data, window.transform, wet_window, polygon)
            if distance is not None:
                nearest_m = distance if nearest_m is None else min(nearest_m, distance)

        records = _occurrence_records(
            valid_pixels=valid_total,
            inside_pixels=inside_total,
            wet_pixels=wet_total,
            occurrence_sum=occurrence_sum,
            occurrence_max=occurrence_max,
            nearest_m=nearest_m,
            threshold=threshold,
            buffer_m=request.buffer_m,
            tiles=tiles,
            tile_urls=tile_urls,
        )
        validate_records(records)
        return records
