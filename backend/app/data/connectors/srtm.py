"""NASA SRTMGL1 v003 terrain connector.

The connector requests only the 1 x 1 degree HGT tiles that intersect the
candidate polygon plus its buffer. It computes elevation, relief, screening slope
and the void fraction. It never fills voids silently and never treats SRTM as a
site survey.
"""
from __future__ import annotations

import io
import math
import os
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import rasterio

from .base import (
    ConnectorUnavailable,
    FetchRequest,
    ParsedRecord,
    RawPayload,
    http_get,
    validate_records,
)
from .raster import read_zonal_window, terrain_statistics

SOURCE_ID = "nasa_srtmgl1"
PARSER_VERSION = "1.0.0"
DATASET_VERSION = "SRTMGL1 v003"
RESOLUTION = "30 m (1 arc-second)"
METHOD = "zonal_dem_statistics"
EVIDENCE_CLASS = "REMOTE_SENSING_DERIVED"
PERIOD_START = "2000-02-11"
PERIOD_END = "2000-02-22"
DEFAULT_BASE_URL = "https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/2000.02.11"
NODATA = -32768


def _base_url() -> str:
    return os.getenv("ECOSITE_SRTM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _tile_label(lat: int, lon: int) -> str:
    lat_label = f"N{abs(lat):02d}" if lat >= 0 else f"S{abs(lat):02d}"
    lon_label = f"E{abs(lon):03d}" if lon >= 0 else f"W{abs(lon):03d}"
    return f"{lat_label}{lon_label}"


def _tile_origins(geometry: dict[str, Any], max_tiles: int) -> list[tuple[int, int]]:
    from shapely.geometry import shape

    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid:
        raise ConnectorUnavailable("Candidate polygon is invalid.")
    west, south, east, north = polygon.bounds
    if not all(math.isfinite(value) for value in (west, south, east, north)):
        raise ConnectorUnavailable("Candidate polygon bounds are not finite.")
    first_lon = math.floor(west)
    last_lon = math.floor(east - 1e-9)
    first_lat = math.floor(south)
    last_lat = math.floor(north - 1e-9)
    tiles = [
        (lat, lon)
        for lat in range(first_lat, last_lat + 1)
        for lon in range(first_lon, last_lon + 1)
    ]
    if not tiles:
        raise ConnectorUnavailable("Candidate polygon does not intersect an SRTM tile.")
    if len(tiles) > max_tiles:
        raise ConnectorUnavailable(
            f"Candidate polygon intersects {len(tiles)} SRTM tiles; the configured limit is {max_tiles}. "
            "Split the polygon or raise the limit deliberately."
        )
    return tiles


def _tile_url(lat: int, lon: int) -> str:
    return f"{_base_url()}/{_tile_label(lat, lon)}.SRTMGL1.hgt.zip"


def _earthdata_headers() -> dict[str, str]:
    token = os.getenv("ECOSITE_EARTHDATA_TOKEN", "").strip()
    if not token:
        raise ConnectorUnavailable(
            "NASA Earthdata token is not configured. Set ECOSITE_EARTHDATA_TOKEN before ingesting SRTM."
        )
    return {"Authorization": f"Bearer {token}"}


def _extract_hgt(content: bytes) -> tuple[str, bytes]:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = [name for name in archive.namelist() if name.lower().endswith(".hgt")]
            if len(names) != 1:
                raise ConnectorUnavailable(
                    f"SRTM archive must contain exactly one .hgt file; found {len(names)}."
                )
            return Path(names[0]).name, archive.read(names[0])
    except zipfile.BadZipFile as error:
        raise ConnectorUnavailable("SRTM response is not a valid zip archive.") from error


def _open_hgt(name: str, content: bytes):
    """Write the HGT to a temporary path so GDAL can infer its georeferencing."""
    directory = tempfile.TemporaryDirectory()
    path = Path(directory.name) / name
    path.write_bytes(content)
    return directory, path


def _terrain_records(
    *,
    inside_pixels: int,
    valid_pixels: int,
    elevation_mean: float | None,
    elevation_min: float | None,
    elevation_max: float | None,
    relief: float | None,
    slope_mean: float | None,
    slope_max: float | None,
    slope_pixels: int,
    tiles: list[str],
    tile_urls: list[str],
    buffer_m: float,
) -> list[ParsedRecord]:
    void_fraction = (inside_pixels - valid_pixels) / inside_pixels if inside_pixels else 1.0
    coverage = valid_pixels / inside_pixels if inside_pixels else 0.0
    if valid_pixels == 0:
        status = "SOURCE_UNAVAILABLE"
        reason = "No valid SRTM elevation pixels inside the candidate polygon."
    elif void_fraction > 0.05:
        status = "PARTIAL"
        reason = None
    else:
        status = "AVAILABLE"
        reason = None

    quality: dict[str, Any] = {
        "tiles": tiles,
        "tile_urls": tile_urls,
        "buffer_m": buffer_m,
        "inside_pixels": inside_pixels,
        "valid_pixels": valid_pixels,
        "void_pixels": inside_pixels - valid_pixels,
        "slope_pixels": slope_pixels,
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

    slope_reason = None
    slope_status = None
    if slope_mean is None and valid_pixels:
        slope_reason = "The polygon contains too few valid pixels to calculate a screening slope."
        slope_status = "PARTIAL"

    return [
        record("terrain_elevation_mean_m", elevation_mean, "m"),
        record("terrain_elevation_min_m", elevation_min, "m"),
        record("terrain_elevation_max_m", elevation_max, "m"),
        record("terrain_relief_m", relief, "m"),
        record(
            "terrain_slope_mean_deg",
            slope_mean,
            "deg",
            missing_reason=slope_reason,
            status_override=slope_status,
        ),
        record(
            "terrain_slope_max_deg",
            slope_max,
            "deg",
            missing_reason=slope_reason,
            status_override=slope_status,
        ),
        record("terrain_void_pixel_fraction", void_fraction, "fraction"),
    ]


class SrtmGl1Connector:
    source_id = SOURCE_ID
    parser_version = PARSER_VERSION

    def fetch(self, request: FetchRequest) -> list[RawPayload]:
        headers = _earthdata_headers()
        fetched_at = datetime.now(timezone.utc).isoformat()
        payloads: list[RawPayload] = []
        for lat, lon in _tile_origins(request.geometry, request.max_tiles):
            label = _tile_label(lat, lon)
            url = _tile_url(lat, lon)
            content, content_type, status = http_get(url, timeout_s=request.timeout_s, headers=headers)
            payloads.append(
                RawPayload(
                    source_id=SOURCE_ID,
                    url=url,
                    content=content,
                    content_type=content_type,
                    http_status=status,
                    fetched_at=fetched_at,
                    filename=f"{label}.SRTMGL1.hgt.zip",
                    dataset_version=DATASET_VERSION,
                )
            )
        return payloads

    def parse(self, payloads: list[RawPayload], request: FetchRequest) -> list[ParsedRecord]:
        from shapely.geometry import shape

        latitude = shape(request.geometry).centroid.y
        inside_total = 0
        valid_total = 0
        elevation_sum = 0.0
        elevation_min: float | None = None
        elevation_max: float | None = None
        slope_sum = 0.0
        slope_pixels_total = 0
        slope_max: float | None = None
        tiles: list[str] = []
        tile_urls: list[str] = []

        for payload in payloads:
            hgt_name, hgt_content = _extract_hgt(payload.content)
            directory, path = _open_hgt(hgt_name, hgt_content)
            try:
                with rasterio.open(path) as src:
                    window = read_zonal_window(
                        src,
                        request.geometry,
                        request.buffer_m,
                        nodata=NODATA,
                    )
            finally:
                directory.cleanup()

            tiles.append(payload.filename)
            tile_urls.append(payload.url)
            stats = terrain_statistics(
                window.data,
                window.transform,
                window.inside,
                window.valid,
                latitude,
            )
            inside_total += stats["inside_pixels"]
            valid_total += stats["valid_pixels"]
            if stats["valid_pixels"] and stats["elevation_mean_m"] is not None:
                elevation_sum += stats["elevation_mean_m"] * stats["valid_pixels"]
                tile_min = stats["elevation_min_m"]
                tile_max = stats["elevation_max_m"]
                elevation_min = tile_min if elevation_min is None else min(elevation_min, tile_min)
                elevation_max = tile_max if elevation_max is None else max(elevation_max, tile_max)
            if stats["slope_pixels"] and stats["slope_mean_deg"] is not None:
                slope_sum += stats["slope_mean_deg"] * stats["slope_pixels"]
                slope_pixels_total += stats["slope_pixels"]
                tile_slope_max = stats["slope_max_deg"]
                slope_max = tile_slope_max if slope_max is None else max(slope_max, tile_slope_max)

        elevation_mean = elevation_sum / valid_total if valid_total else None
        relief = (
            elevation_max - elevation_min
            if elevation_max is not None and elevation_min is not None
            else None
        )
        slope_mean = slope_sum / slope_pixels_total if slope_pixels_total else None

        records = _terrain_records(
            inside_pixels=inside_total,
            valid_pixels=valid_total,
            elevation_mean=elevation_mean,
            elevation_min=elevation_min,
            elevation_max=elevation_max,
            relief=relief,
            slope_mean=slope_mean,
            slope_max=slope_max,
            slope_pixels=slope_pixels_total,
            tiles=tiles,
            tile_urls=tile_urls,
            buffer_m=request.buffer_m,
        )
        validate_records(records)
        return records
