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

    readings: dict[str, Reading | Missing] = dict(UNAVAILABLE_PARAMETERS)
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

    # A failed provider must not leave its parameters looking healthy; fill the
    # gaps with explicit missing reasons.
    for key_name in (
        "air.aqi_us",
        "air.pm25",
        "air.pm10",
        "heat.temperature_max",
        "water.rainfall_24h",
        "water.river_discharge_percentile",
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
