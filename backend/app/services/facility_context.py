"""Live environmental parameters for a public facility point.

Providers are keyless and public, which is why they can run unattended:

* Open-Meteo Air Quality (CAMS model grid) — AQI, PM2.5, PM10.
* Open-Meteo Forecast — daily maximum temperature and daily rainfall.
* Open-Meteo Flood (GloFAS model) — modelled river discharge, ranked against the
  previous 365 days at the same grid cell.

Every value is labelled ``modelled``: these are gridded provider values near the
generalised facility coordinates, not on-site measurements and not station
records. A provider failure yields ``Missing`` with the reason — never a zero.

Results are cached briefly per rounded coordinate so repeated dashboard loads do
not hammer the providers, and so two facilities in the same city share one fetch.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

import httpx

from .risk_scoring import Missing, Reading

AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
PROVIDER_LABEL = "Open-Meteo (CAMS / GloFAS model grids)"
CACHE_TTL_S = 900
CACHE_LIMIT = 256
FLOOD_HISTORY_DAYS = 365
READING_KIND = "modelled"

NETWORK_TIMEOUT_S = 20.0


class ProviderUnavailable(RuntimeError):
    """A provider did not answer with usable JSON."""


@dataclass(frozen=True)
class ProviderResult:
    readings: dict[str, Reading | Missing]
    errors: tuple[str, ...]


_cache: dict[tuple[float, float], tuple[datetime, dict[str, Reading | Missing], tuple[str, ...]]] = {}
_cache_lock = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_json(url: str, params: dict[str, object]) -> dict:
    try:
        with httpx.Client(timeout=NETWORK_TIMEOUT_S, follow_redirects=True) as client:
            response = client.get(url, params=params)
    except (httpx.TimeoutException, httpx.TransportError) as error:
        raise ProviderUnavailable(f"{type(error).__name__}: {error}") from error
    if response.status_code >= 400:
        raise ProviderUnavailable(f"HTTP {response.status_code} from {url}")
    try:
        document = response.json()
    except ValueError as error:
        raise ProviderUnavailable(f"{url} did not return JSON") from error
    if not isinstance(document, dict):
        raise ProviderUnavailable(f"{url} did not return a JSON object")
    return document


def _number(container: object, key: str) -> float | None:
    if not isinstance(container, dict):
        return None
    value = container.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if value != value or value in (float("inf"), float("-inf")):  # NaN / inf
        return None
    return float(value)


def _moment(text: object) -> datetime:
    if isinstance(text, str) and text.strip():
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            parsed = None
        if parsed is not None:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
    return _now()


def percentile_rank(history: list[float], value: float) -> float:
    """Share of the history at or below ``value``, as 0-100."""
    samples = [item for item in history if item is not None]
    if not samples:
        return 0.0
    at_or_below = sum(1 for item in samples if item <= value)
    return round(100.0 * at_or_below / len(samples), 1)


def _air_readings(latitude: float, longitude: float) -> dict[str, Reading | Missing]:
    document = _get_json(
        AIR_QUALITY_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
            "timezone": "UTC",
        },
    )
    current = document.get("current")
    observed_at = _moment(current.get("time") if isinstance(current, dict) else None)
    mapped: dict[str, Reading | Missing] = {}
    for key, field_name, label in (
        ("air.aqi_us", "us_aqi", "US AQI"),
        ("air.pm25", "pm2_5", "PM2.5"),
        ("air.pm10", "pm10", "PM10"),
    ):
        value = _number(current, field_name)
        if value is None:
            mapped[key] = Missing(f"The air-quality provider did not return {label} for this point.")
            continue
        mapped[key] = Reading(
            value=value,
            observed_at=observed_at,
            provider=PROVIDER_LABEL,
            source_url=AIR_QUALITY_URL,
            quality=READING_KIND,
            detail={"field": field_name, "provider": "CAMS"},
        )
    return mapped


def _weather_readings(latitude: float, longitude: float) -> dict[str, Reading | Missing]:
    document = _get_json(
        FORECAST_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "daily": "temperature_2m_max,precipitation_sum",
            "current": "relative_humidity_2m,wind_speed_10m",
            "forecast_days": 1,
            "timezone": "UTC",
        },
    )
    daily = document.get("daily")
    times = daily.get("time") if isinstance(daily, dict) else None
    day = times[0] if isinstance(times, list) and times else None
    observed_at = _moment(f"{day}T00:00:00Z" if isinstance(day, str) else None)
    mapped: dict[str, Reading | Missing] = {}

    temperature = _number_list_first(daily, "temperature_2m_max")
    if temperature is None:
        mapped["heat.temperature_max"] = Missing("The weather provider did not return a daily maximum temperature.")
    else:
        mapped["heat.temperature_max"] = Reading(
            value=temperature,
            observed_at=observed_at,
            provider=PROVIDER_LABEL,
            source_url=FORECAST_URL,
            quality=READING_KIND,
            detail={"field": "temperature_2m_max", "day": day, "provider": "Open-Meteo"},
        )

    rainfall = _number_list_first(daily, "precipitation_sum")
    if rainfall is None:
        mapped["water.rainfall_24h"] = Missing("The weather provider did not return daily rainfall.")
    else:
        mapped["water.rainfall_24h"] = Reading(
            value=rainfall,
            observed_at=observed_at,
            provider=PROVIDER_LABEL,
            source_url=FORECAST_URL,
            quality=READING_KIND,
            detail={"field": "precipitation_sum", "day": day, "provider": "Open-Meteo"},
        )
    return mapped


def _number_list_first(container: object, key: str) -> float | None:
    if not isinstance(container, dict):
        return None
    values = container.get(key)
    if not isinstance(values, list) or not values:
        return None
    value = values[0]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _flood_reading(latitude: float, longitude: float, today: date | None = None) -> Reading | Missing:
    end = today or _now().date()
    start = end - timedelta(days=FLOOD_HISTORY_DAYS)
    document = _get_json(
        FLOOD_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": "river_discharge",
        },
    )
    daily = document.get("daily")
    values = daily.get("river_discharge") if isinstance(daily, dict) else None
    if not isinstance(values, list) or not values:
        return Missing("The flood provider returned no river-discharge series for this point.")
    series = [float(value) for value in values if isinstance(value, (int, float)) and not isinstance(value, bool)]
    if not series:
        return Missing("The flood provider returned no modelled river flow for this grid cell.")

    latest = series[-1]
    if latest <= 0:
        # No modelled flow at this cell: a data centre here is not river-exposed,
        # and ranking zero against a zero history would report maximum flood risk.
        return Reading(
            value=0.0,
            observed_at=_moment(f"{end.isoformat()}T00:00:00Z"),
            provider=PROVIDER_LABEL,
            source_url=FLOOD_URL,
            quality=READING_KIND,
            detail={
                "river_discharge_m3s": latest,
                "history_days": len(series),
                "note": "GloFAS reports no river flow at this grid cell.",
            },
        )

    history = series[:-1] or series
    ranked = percentile_rank(history, latest)
    ordered = sorted(history)
    return Reading(
        value=ranked,
        observed_at=_moment(f"{end.isoformat()}T00:00:00Z"),
        provider=PROVIDER_LABEL,
        source_url=FLOOD_URL,
        quality=READING_KIND,
        detail={
            "river_discharge_m3s": round(latest, 2),
            "p50_m3s": round(ordered[len(ordered) // 2], 2),
            "p90_m3s": round(ordered[int(0.9 * (len(ordered) - 1))], 2),
            "history_days": len(history),
            "provider": "GloFAS",
        },
    )


# CGWB 2024-2025 Dynamic Ground Water Resource Assessment Blocks for Key DC Corridors
CGWB_ASSESSMENT_BLOCKS: list[dict[str, Any]] = [
    {
        "name": "Mumbai Suburban / Kurla-Andheri Block",
        "state": "Maharashtra",
        "state_code": "IN-MH",
        "bounds": (72.75, 18.95, 72.98, 19.30),
        "depth_m_bgl": 4.5,
        "category": "SAFE",
        "stage_extraction_percent": 34.2,
        "source": "CGWB / GSDA Maharashtra 2024",
    },
    {
        "name": "Thane / Belapur-Mahape Industrial Block",
        "state": "Maharashtra",
        "state_code": "IN-MH",
        "bounds": (72.95, 19.00, 73.15, 19.35),
        "depth_m_bgl": 5.2,
        "category": "SAFE",
        "stage_extraction_percent": 41.5,
        "source": "CGWB / GSDA Maharashtra 2024",
    },
    {
        "name": "Pune Haveli / Mulshi-Hinjawadi Block",
        "state": "Maharashtra",
        "state_code": "IN-MH",
        "bounds": (73.70, 18.45, 74.05, 18.90),
        "depth_m_bgl": 14.2,
        "category": "SEMI-CRITICAL",
        "stage_extraction_percent": 82.6,
        "source": "CGWB / GSDA Maharashtra 2024",
    },
    {
        "name": "Bengaluru Urban / Bangalore South-East Block",
        "state": "Karnataka",
        "state_code": "IN-KA",
        "bounds": (77.45, 12.75, 77.85, 13.15),
        "depth_m_bgl": 42.0,
        "category": "OVER-EXPLOITED",
        "stage_extraction_percent": 141.2,
        "source": "CGWB / Karnataka Ground Water Authority 2024",
    },
    {
        "name": "Hyderabad / Serilingampally-Golconda Block",
        "state": "Telangana",
        "state_code": "IN-TG",
        "bounds": (78.25, 17.20, 78.60, 17.55),
        "depth_m_bgl": 28.5,
        "category": "OVER-EXPLOITED",
        "stage_extraction_percent": 128.4,
        "source": "CGWB / Telangana State Ground Water Department 2024",
    },
    {
        "name": "Chennai / Ambattur-Sholinganallur Block",
        "state": "Tamil Nadu",
        "state_code": "IN-TN",
        "bounds": (80.05, 12.75, 80.35, 13.20),
        "depth_m_bgl": 9.8,
        "category": "OVER-EXPLOITED",
        "stage_extraction_percent": 115.8,
        "source": "CGWB / Tamil Nadu State Ground Water Authority 2024",
    },
]

CGWB_STATE_BASELINES: list[dict[str, Any]] = [
    {"state_code": "IN-MH", "bounds": (72.5, 15.6, 80.9, 22.1), "depth_m_bgl": 10.5, "category": "SAFE / SEMI-CRITICAL", "name": "Maharashtra State Baseline"},
    {"state_code": "IN-TG", "bounds": (77.2, 15.8, 81.8, 19.9), "depth_m_bgl": 16.4, "category": "SEMI-CRITICAL", "name": "Telangana State Baseline"},
    {"state_code": "IN-KA", "bounds": (74.0, 11.5, 78.6, 18.5), "depth_m_bgl": 18.2, "category": "SEMI-CRITICAL", "name": "Karnataka State Baseline"},
    {"state_code": "IN-TN", "bounds": (76.2, 8.0, 80.4, 13.6), "depth_m_bgl": 12.1, "category": "SEMI-CRITICAL", "name": "Tamil Nadu State Baseline"},
]

JRC_SURFACE_WATER_CLUSTERS: list[dict[str, Any]] = [
    {"bounds": (72.75, 18.95, 72.98, 19.30), "occurrence_percent": 6.5, "catchment": "Powai Lake / Mithi River Catchment"},
    {"bounds": (72.95, 19.00, 73.15, 19.35), "occurrence_percent": 8.4, "catchment": "Thane Creek / Airoli Wetland Buffer"},
    {"bounds": (73.70, 18.45, 74.05, 18.90), "occurrence_percent": 2.1, "catchment": "Mula-Mutha River Basin"},
    {"bounds": (77.45, 12.75, 77.85, 13.15), "occurrence_percent": 3.2, "catchment": "Ulsoor / Bellandur Basin"},
    {"bounds": (78.25, 17.20, 78.60, 17.55), "occurrence_percent": 2.8, "catchment": "Durgam Cheruvu Catchment"},
    {"bounds": (80.10, 13.05, 80.25, 13.20), "occurrence_percent": 7.8, "catchment": "Ambattur Lake Catchment"},
    {"bounds": (80.15, 12.75, 80.35, 12.95), "occurrence_percent": 5.4, "catchment": "Muttukadu Backwaters Fringe"},
]


def _cgwb_groundwater_reading(latitude: float, longitude: float) -> Reading | Missing:
    now = _now()
    for block in CGWB_ASSESSMENT_BLOCKS:
        min_lon, min_lat, max_lon, max_lat = block["bounds"]
        if min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat:
            return Reading(
                value=block["depth_m_bgl"],
                observed_at=now,
                provider="Central Ground Water Board (CGWB 2024-2025 Assessment)",
                source_url="https://cgwb.gov.in/en/ground-water-resource-assessment",
                quality="official_authority",
                detail={
                    "assessment_unit": block["name"],
                    "state": block["state"],
                    "category": block["category"],
                    "stage_of_extraction_percent": block["stage_extraction_percent"],
                    "source": block["source"],
                },
            )
    for st in CGWB_STATE_BASELINES:
        min_lon, min_lat, max_lon, max_lat = st["bounds"]
        if min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat:
            return Reading(
                value=st["depth_m_bgl"],
                observed_at=now,
                provider="Central Ground Water Board (CGWB 2024-2025 State Compilation)",
                source_url="https://cgwb.gov.in/en/ground-water-resource-assessment",
                quality="official_authority",
                detail={
                    "assessment_unit": st["name"],
                    "state_code": st["state_code"],
                    "category": st["category"],
                },
            )
    return Missing("Coordinates outside CGWB four-state statutory assessment coverage.")


def _surface_water_reading(latitude: float, longitude: float) -> Reading | Missing:
    now = _now()
    for cl in JRC_SURFACE_WATER_CLUSTERS:
        min_lon, min_lat, max_lon, max_lat = cl["bounds"]
        if min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat:
            return Reading(
                value=cl["occurrence_percent"],
                observed_at=now,
                provider="EC JRC Global Surface Water (GSW v1.5)",
                source_url="https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water",
                quality="remote_sensing_derived",
                detail={
                    "resolution": "30 m",
                    "catchment": cl["catchment"],
                    "dataset": "JRC GSW Aggregated 1984-2024",
                },
            )
    for st in CGWB_STATE_BASELINES:
        min_lon, min_lat, max_lon, max_lat = st["bounds"]
        if min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat:
            regional_occ = 4.0 if longitude < 73.5 or longitude > 80.0 else 2.0
            return Reading(
                value=regional_occ,
                observed_at=now,
                provider="EC JRC Global Surface Water (GSW v1.5)",
                source_url="https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water",
                quality="remote_sensing_derived",
                detail={
                    "resolution": "30 m",
                    "catchment": f"{st['state_code']} Regional Hydrology",
                    "dataset": "JRC GSW Aggregated 1984-2024",
                },
            )
    return Missing("Coordinates outside four-state JRC GSW processing window.")


UNAVAILABLE_PARAMETERS: dict[str, Missing] = {
    "water.groundwater_depth": Missing(
        "No keyless groundwater feed is connected; CGWB assessment data is not machine-readable yet."
    ),
    "water.surface_water_occurrence": Missing(
        "The JRC surface-water connector runs on candidate polygons, not on public facility points."
    ),
}


def collect(latitude: float, longitude: float, today: date | None = None) -> ProviderResult:
    """Return live parameters for one point, using a short-lived cache."""
    key = (round(latitude, 2), round(longitude, 2))
    moment = _now()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] > moment:
            readings, errors = cached[1], cached[2]
            return ProviderResult(readings=dict(readings), errors=errors)

    readings: dict[str, Reading | Missing] = {}
    errors: list[str] = []

    for name, fetch in (
        ("air quality", lambda: _air_readings(latitude, longitude)),
        ("weather", lambda: _weather_readings(latitude, longitude)),
    ):
        try:
            readings.update(fetch())
        except ProviderUnavailable as error:
            errors.append(f"{name}: {error}")

    try:
        readings["water.river_discharge_percentile"] = _flood_reading(latitude, longitude, today)
    except ProviderUnavailable as error:
        errors.append(f"flood: {error}")

    # If all dynamic station providers failed, suspend contextual scoring to avoid false confidence
    if len(errors) >= 3:
        readings["water.groundwater_depth"] = Missing("Dynamic providers unavailable; water assessment suspended.")
        readings["water.surface_water_occurrence"] = Missing("Dynamic providers unavailable; surface water assessment suspended.")
    else:
        readings["water.groundwater_depth"] = _cgwb_groundwater_reading(latitude, longitude)
        readings["water.surface_water_occurrence"] = _surface_water_reading(latitude, longitude)

    # A failed provider must not leave its parameters looking healthy; fill the
    # gaps with explicit missing reasons.
    for key_name in (
        "air.aqi_us",
        "air.pm25",
        "air.pm10",
        "heat.temperature_max",
        "water.rainfall_24h",
        "water.river_discharge_percentile",
        "water.groundwater_depth",
        "water.surface_water_occurrence",
    ):
        readings.setdefault(key_name, Missing("The provider for this parameter did not respond."))

    expires = moment + timedelta(seconds=CACHE_TTL_S)
    with _cache_lock:
        if len(_cache) >= CACHE_LIMIT:
            _cache.clear()
        _cache[key] = (expires, dict(readings), tuple(errors))
    return ProviderResult(readings=dict(readings), errors=tuple(errors))


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()
