"""Persistence-neutral environmental monitoring queries and status rules."""
from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Literal, Protocol


MetricKey = Literal[
    "aqi", "pm25", "pm10", "no2", "so2", "co", "o3", "temperature",
    "relative_humidity", "rainfall", "wind_speed", "wind_direction",
    "groundwater_depth", "groundwater_assessment",
]
RangeKey = Literal["24h", "7d", "30d", "90d", "1y"]
IntervalKey = Literal["auto", "raw", "hour", "day"]
ResolvedInterval = Literal["raw", "hour", "day"]
Availability = Literal["AVAILABLE", "PARTIAL", "STALE", "SOURCE_UNAVAILABLE", "NOT_COVERED", "UNKNOWN"]

METRIC_UNITS: dict[str, str] = {
    "aqi": "index", "pm25": "ug/m3", "pm10": "ug/m3", "no2": "ug/m3",
    "so2": "ug/m3", "co": "mg/m3", "o3": "ug/m3", "temperature": "degC",
    "relative_humidity": "percent", "rainfall": "mm", "wind_speed": "m/s",
    "wind_direction": "degree", "groundwater_depth": "m_bgl",
    "groundwater_assessment": "category",
}
DEFAULT_CURRENT_METRICS: tuple[str, ...] = tuple(METRIC_UNITS)
RANGE_DURATION = {
    "24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30),
    "90d": timedelta(days=90), "1y": timedelta(days=365),
}
CONTEXT_NOTICE = "Nearby public monitoring-station context; not an on-site facility measurement."


class EnvironmentalFacilityNotFound(LookupError):
    pass


class InvalidEnvironmentalQuery(ValueError):
    pass


@dataclass(frozen=True)
class StationContext:
    station_id: str
    name: str
    provider: str
    source_id: str
    public_coordinates: tuple[float, float]
    station_type: str
    distance_km: float
    selection_method: str
    effective_at: datetime


@dataclass(frozen=True)
class Provenance:
    source_id: str
    provider: str
    dataset: str
    source_url: str
    retrieved_at: datetime
    evidence_class: str
    temporal_class: str
    visibility: str


@dataclass(frozen=True)
class CurrentMetric:
    metric: str
    display_name: str
    value: float | str | None
    unit: str
    availability: Availability
    quality: str
    observed_at: datetime | None
    published_at: datetime | None
    retrieved_at: datetime | None
    fresh_until: datetime | None
    quality_flags: tuple[str, ...]
    station: StationContext | None
    provenance: Provenance | None
    context_notice: str
    original_value: float | str | None = None
    original_unit: str | None = None


@dataclass(frozen=True)
class CurrentContext:
    facility_id: str
    generated_at: datetime
    metrics: tuple[CurrentMetric, ...]


@dataclass(frozen=True)
class SeriesPoint:
    timestamp: datetime
    value: float | str | None
    minimum: float | None = None
    maximum: float | None = None
    sample_count: int = 0
    coverage_fraction: float = 0.0
    quality_flags: tuple[str, ...] = ()
    original_value: float | str | None = None
    original_unit: str | None = None


@dataclass(frozen=True)
class MetricSeries:
    metric: str
    display_name: str
    unit: str
    availability: Availability
    quality: str
    coverage_fraction: float
    expected_sample_count: int
    valid_sample_count: int
    station: StationContext | None
    provenance: Provenance | None
    points: tuple[SeriesPoint, ...]
    context_notice: str


@dataclass(frozen=True)
class RangeContext:
    facility_id: str
    range: str
    interval: str
    from_at: datetime
    to_at: datetime
    generated_at: datetime
    series: tuple[MetricSeries, ...]


@dataclass(frozen=True)
class StateMetricSummary:
    metric: str
    display_name: str
    unit: str
    availability: Availability
    covered_facility_count: int
    current_facility_count: int
    stale_facility_count: int
    unavailable_facility_count: int
    minimum: float | None
    maximum: float | None
    mean: float | None
    aggregation_method: str
    context_notice: str


@dataclass(frozen=True)
class SourceHealth:
    source_id: str
    status: str
    last_checked_at: datetime | None
    last_success_at: datetime | None


@dataclass(frozen=True)
class StateSummary:
    state_code: str
    range: str
    generated_at: datetime
    facility_count: int
    covered_facility_count: int
    metrics: tuple[StateMetricSummary, ...]
    source_health: tuple[SourceHealth, ...]


class EnvironmentalRepository(Protocol):
    def is_public_facility(self, facility_id: str) -> bool: ...
    def current_metrics(self, facility_id: str, metrics: Sequence[str]) -> Sequence[CurrentMetric]: ...
    def metric_series(
        self, facility_id: str, metrics: Sequence[str], start: datetime, end: datetime,
        interval: ResolvedInterval,
    ) -> Sequence[MetricSeries]: ...
    def state_summary(self, state_code: str, metrics: Sequence[str], range_key: str) -> StateSummary: ...


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def validate_metrics(metrics: Sequence[str] | None, *, default_all: bool) -> tuple[str, ...]:
    values = tuple(dict.fromkeys(metrics or (DEFAULT_CURRENT_METRICS if default_all else ())))
    if not values:
        raise InvalidEnvironmentalQuery("At least one metric is required")
    unknown = [metric for metric in values if metric not in METRIC_UNITS]
    if unknown:
        raise InvalidEnvironmentalQuery(f"Unsupported metrics: {', '.join(unknown)}")
    return values


def resolve_interval(range_key: str, interval: str) -> ResolvedInterval:
    if range_key not in RANGE_DURATION:
        raise InvalidEnvironmentalQuery("Unsupported range")
    if interval not in ("auto", "raw", "hour", "day"):
        raise InvalidEnvironmentalQuery("Unsupported interval")
    if interval == "raw" and range_key in ("30d", "90d", "1y"):
        raise InvalidEnvironmentalQuery("Raw interval exceeds the supported point window")
    if interval != "auto":
        return interval  # type: ignore[return-value]
    return "hour" if range_key in ("24h", "7d") else "day"


def unavailable_current(metric: str) -> CurrentMetric:
    return CurrentMetric(
        metric=metric, display_name=metric.replace("_", " ").title(), value=None,
        unit=METRIC_UNITS[metric], availability="NOT_COVERED", quality="unknown",
        observed_at=None, published_at=None, retrieved_at=None, fresh_until=None,
        quality_flags=("no_eligible_station",), station=None, provenance=None,
        context_notice="No suitable public monitoring station is linked to this facility.",
    )


def unavailable_series(metric: str) -> MetricSeries:
    return MetricSeries(
        metric=metric, display_name=metric.replace("_", " ").title(), unit=METRIC_UNITS[metric],
        availability="NOT_COVERED", quality="unknown", coverage_fraction=0.0,
        expected_sample_count=0, valid_sample_count=0, station=None, provenance=None,
        points=(), context_notice="No suitable public monitoring station is linked to this facility.",
    )


class EnvironmentalMonitoringService:
    def __init__(self, repository: EnvironmentalRepository, clock: Callable[[], datetime] = utc_now) -> None:
        self._repository = repository
        self._clock = clock

    def _require_facility(self, facility_id: str) -> None:
        if not self._repository.is_public_facility(facility_id):
            raise EnvironmentalFacilityNotFound("Public facility not found")

    def get_current(self, facility_id: str, metrics: Sequence[str] | None = None) -> CurrentContext:
        self._require_facility(facility_id)
        requested = validate_metrics(metrics, default_all=True)
        now = self._clock()
        returned = {item.metric: item for item in self._repository.current_metrics(facility_id, requested)}
        result = []
        for metric in requested:
            item = returned.get(metric, unavailable_current(metric))
            if item.value is None and item.availability == "AVAILABLE":
                item = replace(item, availability="UNKNOWN", quality_flags=(*item.quality_flags, "missing_value"))
            elif item.fresh_until and item.fresh_until < now and item.availability in ("AVAILABLE", "PARTIAL"):
                item = replace(item, availability="STALE")
            result.append(item)
        return CurrentContext(facility_id, now, tuple(result))

    def get_range(
        self, facility_id: str, metrics: Sequence[str], range_key: str = "24h", interval: str = "auto",
    ) -> RangeContext:
        self._require_facility(facility_id)
        requested = validate_metrics(metrics, default_all=False)
        resolved = resolve_interval(range_key, interval)
        end = self._clock()
        start = end - RANGE_DURATION[range_key]
        returned = {
            item.metric: item
            for item in self._repository.metric_series(facility_id, requested, start, end, resolved)
        }
        series = tuple(returned.get(metric, unavailable_series(metric)) for metric in requested)
        return RangeContext(facility_id, range_key, resolved, start, end, end, series)

    def get_state_summary(
        self, state_code: str, metrics: Sequence[str] | None = None, range_key: str = "24h",
    ) -> StateSummary:
        if range_key not in RANGE_DURATION:
            raise InvalidEnvironmentalQuery("Unsupported range")
        requested = validate_metrics(metrics, default_all=True)
        return self._repository.state_summary(state_code, requested, range_key)

