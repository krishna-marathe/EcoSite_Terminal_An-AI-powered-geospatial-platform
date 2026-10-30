"""NASA POWER daily climate reanalysis connector.

The connector requests daily meteorological parameters (ambient 2m temperature,
maximum temperature, minimum temperature, relative humidity, and surface solar
irradiance) for the centroid of a candidate polygon.

It calculates screening metrics:
- Annual mean ambient temperature (°C)
- Annual maximum temperature (°C)
- Annual minimum temperature (°C)
- Annual mean relative humidity (%)
- Annual mean solar GHI (kWh/m²/day)
- Cooling degree days (CDD, base 18°C)

Provenance:
- Evidence class: MODELLED (MERRA-2 global atmospheric reanalysis).
- Resolution: 0.5 x 0.625 degree reanalysis grid.
- Method: point_temporal_daily_reanalysis.
- It never presents modelled reanalysis as an on-site calibrated weather station.
"""
from __future__ import annotations

import json
import os
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from shapely.geometry import shape

from .base import (
    ConnectorUnavailable,
    FetchRequest,
    ParsedRecord,
    RawPayload,
    http_get,
    validate_records,
)

SOURCE_ID = "nasa_power"
PARSER_VERSION = "1.0.0"
DATASET_VERSION = "POWER v2.0 (MERRA-2)"
RESOLUTION = "0.5 x 0.625 degree reanalysis grid"
METHOD = "point_temporal_daily_reanalysis"
EVIDENCE_CLASS = "MODELLED"
DEFAULT_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
DEFAULT_COMMUNITY = "RE"
DEFAULT_PARAMETERS = ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "ALLSKY_SFC_SW_DWN"]
NODATA_VALUE = -999.0
BASE_CDD_TEMP = 18.0


def _base_url() -> str:
    return os.getenv("ECOSITE_NASA_POWER_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _query_dates() -> tuple[str, str]:
    """Return default 365-day observation window (YYYYMMDD) lagged by 3 days for NASA latency."""
    end = datetime.now(timezone.utc) - timedelta(days=3)
    start = end - timedelta(days=365)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


def _centroid_coordinates(geometry: dict[str, Any]) -> tuple[float, float]:
    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid:
        raise ConnectorUnavailable("Candidate polygon is invalid for NASA POWER centroid calculation.")
    centroid = polygon.centroid
    return round(float(centroid.y), 4), round(float(centroid.x), 4)


class NasaPowerConnector:
    source_id = SOURCE_ID
    parser_version = PARSER_VERSION

    def fetch(self, request: FetchRequest) -> list[RawPayload]:
        lat, lon = _centroid_coordinates(request.geometry)
        start, end = _query_dates()
        base = _base_url()
        params = ",".join(DEFAULT_PARAMETERS)
        url = (
            f"{base}?latitude={lat}&longitude={lon}&parameters={params}"
            f"&community={DEFAULT_COMMUNITY}&start={start}&end={end}&format=JSON"
        )
        fetched_at = datetime.now(timezone.utc).isoformat()
        content, content_type, status = http_get(url, timeout_s=request.timeout_s)
        return [
            RawPayload(
                source_id=SOURCE_ID,
                url=url,
                content=content,
                content_type=content_type,
                http_status=status,
                fetched_at=fetched_at,
                filename="nasa_power_daily.json",
                dataset_version=DATASET_VERSION,
                metadata={
                    "latitude": lat,
                    "longitude": lon,
                    "start": start,
                    "end": end,
                    "parameters": DEFAULT_PARAMETERS,
                },
            )
        ]

    def parse(self, payloads: list[RawPayload], request: FetchRequest) -> list[ParsedRecord]:
        if not payloads:
            raise ConnectorUnavailable("NASA POWER connector received no raw payload.")
        payload = payloads[0]
        try:
            doc = json.loads(payload.content)
        except (ValueError, UnicodeDecodeError) as err:
            raise ConnectorUnavailable("NASA POWER response is not valid JSON.") from err

        properties = doc.get("properties", {})
        param_data = properties.get("parameter", {})

        def get_series(param_name: str) -> list[float]:
            series = param_data.get(param_name, {})
            if isinstance(series, dict):
                return [float(v) for v in series.values() if v is not None and float(v) != NODATA_VALUE]
            return []

        t2m_vals = get_series("T2M")
        t2m_max_vals = get_series("T2M_MAX")
        t2m_min_vals = get_series("T2M_MIN")
        rh2m_vals = get_series("RH2M")
        ghi_vals = get_series("ALLSKY_SFC_SW_DWN")

        metadata = payload.metadata or {}
        lat = metadata.get("latitude")
        lon = metadata.get("longitude")
        start_date = metadata.get("start")
        end_date = metadata.get("end")

        iso_start = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:8]}" if start_date and len(start_date) == 8 else None
        iso_end = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:8]}" if end_date and len(end_date) == 8 else None

        valid_days = len(t2m_vals)
        if valid_days == 0:
            status = "SOURCE_UNAVAILABLE"
            reason = "No valid daily meteorological observations returned by NASA POWER for this location."
            mean_temp = None
            max_temp = None
            min_temp = None
            mean_rh = None
            mean_ghi = None
            cdd = None
        else:
            status = "AVAILABLE" if valid_days >= 300 else "PARTIAL"
            reason = None
            mean_temp = round(float(statistics.mean(t2m_vals)), 2)
            max_temp = round(float(max(t2m_max_vals if t2m_max_vals else t2m_vals)), 2)
            min_temp = round(float(min(t2m_min_vals if t2m_min_vals else t2m_vals)), 2)
            mean_rh = round(float(statistics.mean(rh2m_vals)), 1) if rh2m_vals else None
            mean_ghi = round(float(statistics.mean(ghi_vals)), 2) if ghi_vals else None
            cdd = round(float(sum(max(0.0, val - BASE_CDD_TEMP) for val in t2m_vals)), 1)

        quality: dict[str, Any] = {
            "source": "NASA POWER",
            "reanalysis_model": "MERRA-2",
            "latitude": lat,
            "longitude": lon,
            "valid_days": valid_days,
            "cdd_base_temperature_c": BASE_CDD_TEMP,
            "note": "Modelled reanalysis data from NASA POWER; not an on-site meteorological station measurement.",
        }

        def record(
            indicator: str,
            value: float | None,
            unit: str,
            missing_reason: str | None = None,
        ) -> ParsedRecord:
            return ParsedRecord(
                indicator=indicator,
                value=value,
                unit=unit,
                status=status if value is not None else "SOURCE_UNAVAILABLE",
                evidence_class=EVIDENCE_CLASS,
                dataset_version=DATASET_VERSION,
                period_start=iso_start,
                period_end=iso_end,
                observed_at=None,
                published_at=None,
                resolution=RESOLUTION,
                method=METHOD,
                processing_version=PARSER_VERSION,
                coverage_fraction=round(valid_days / 365.0, 3) if valid_days else 0.0,
                quality_flags=quality,
                missing_reason=missing_reason or reason,
            )

        records = [
            record("ambient_temperature_mean_c", mean_temp, "deg_c"),
            record("ambient_temperature_max_c", max_temp, "deg_c"),
            record("ambient_temperature_min_c", min_temp, "deg_c"),
            record("relative_humidity_mean_percent", mean_rh, "%"),
            record("solar_ghi_annual_mean_kwh_per_sqm_day", mean_ghi, "kWh/m2/day"),
            record("cooling_degree_days_cdd_base_18c", cdd, "deg_days"),
        ]
        validate_records(records)
        return records

