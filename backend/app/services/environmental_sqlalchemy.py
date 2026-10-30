"""SQLAlchemy implementation of the environmental query repository."""
from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import datetime, timedelta, timezone
from statistics import fmean

from pydantic import HttpUrl, TypeAdapter
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..data.models import DataSource

_URL_ADAPTER = TypeAdapter(HttpUrl)
_FALLBACK_URL = "https://data.gov.in"


def _safe_url(candidate: str | None) -> str | None:
    if not candidate:
        return None
    cleaned = str(candidate).strip()
    if not cleaned:
        return None
    try:
        _URL_ADAPTER.validate_python(cleaned)
        return cleaned
    except Exception:
        return None

from ..models.environmental import (
    EnvironmentalObservation, EnvironmentalRollup, FacilityStationLink,
    MetricDefinition, MonitoringStation,
)
from ..models.public_registry import PublicFacilityRecord, PublicFacilitySnapshot
from .environmental_monitoring import (
    CONTEXT_NOTICE, CurrentMetric, EnvironmentalRepository, MetricSeries, Provenance,
    SeriesPoint, SourceHealth, StateMetricSummary, StateSummary, StationContext,
)


class EnvironmentalStorageError(RuntimeError):
    pass


def _dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class SqlAlchemyEnvironmentalRepository(EnvironmentalRepository):
    def __init__(self, session_factory: Callable[[], Session], clock=lambda: datetime.now(timezone.utc)) -> None:
        self._session_factory = session_factory
        self._clock = clock

    def _execute(self, callback):
        try:
            with self._session_factory() as session:
                return callback(session)
        except SQLAlchemyError as error:
            raise EnvironmentalStorageError("Environmental storage is unavailable") from error

    def is_public_facility(self, facility_id: str) -> bool:
        return self._execute(lambda session: session.scalar(select(PublicFacilitySnapshot.id).where(
            PublicFacilitySnapshot.facility_id == facility_id,
            PublicFacilitySnapshot.is_current.is_(True),
            PublicFacilitySnapshot.visibility == "PUBLIC",
        )) is not None)

    def _context(self, session: Session, facility_id: str, metric: str):
        now_text = self._clock().isoformat()
        link = session.scalar(select(FacilityStationLink).where(
            FacilityStationLink.facility_id == facility_id,
            FacilityStationLink.metric_key == metric,
            FacilityStationLink.is_primary.is_(True),
            FacilityStationLink.effective_at <= now_text,
            (FacilityStationLink.expires_at.is_(None) | (FacilityStationLink.expires_at > now_text)),
        ).order_by(FacilityStationLink.effective_at.desc()))
        if link is None:
            return None
        station = session.get(MonitoringStation, link.station_id)
        definition = session.get(MetricDefinition, metric)
        source = session.get(DataSource, station.source_id) if station else None
        if station is None or definition is None or source is None:
            return None
        station_context = StationContext(
            station.id, station.name, station.provider, station.source_id,
            (station.public_longitude, station.public_latitude), station.station_type,
            link.distance_km, link.selection_method, _dt(link.effective_at),
        )
        return link, station, definition, source, station_context

    @staticmethod
    def _provenance(source: DataSource, retrieved_at: datetime) -> Provenance:
        url = (
            _safe_url(getattr(source, "exact_endpoint", None))
            or _safe_url(getattr(source, "base_url", None))
            or _FALLBACK_URL
        )
        return Provenance(
            source.id, source.provider, source.dataset_name,
            url, retrieved_at,
            "measured", "near_real_time", "public",
        )


    def current_metrics(self, facility_id: str, metrics: Sequence[str]) -> Sequence[CurrentMetric]:
        def query(session: Session):
            result = []
            for metric in metrics:
                context = self._context(session, facility_id, metric)
                if context is None:
                    continue
                link, station, definition, source, station_context = context
                observation = session.scalar(select(EnvironmentalObservation).where(
                    EnvironmentalObservation.station_id == station.id,
                    EnvironmentalObservation.metric_key == metric,
                    EnvironmentalObservation.visibility == "PUBLIC",
                ).order_by(EnvironmentalObservation.observed_at.desc()).limit(1))
                if observation is None:
                    continue
                observed = _dt(observation.observed_at)
                retrieved = _dt(observation.retrieved_at)
                value = observation.value if observation.value is not None else observation.category_value
                original = observation.original_value if observation.original_value is not None else observation.original_category_value
                fresh_until = observed + timedelta(seconds=definition.stale_after_seconds) if observed else None
                result.append(CurrentMetric(
                    metric, definition.display_name, value, observation.canonical_unit,
                    observation.status, observation.quality, observed, _dt(observation.published_at),
                    retrieved, fresh_until, tuple(observation.quality_flags), station_context,
                    self._provenance(source, retrieved), CONTEXT_NOTICE,
                    original_value=original, original_unit=observation.original_unit,
                ))
            return result
        return self._execute(query)

    def metric_series(self, facility_id: str, metrics: Sequence[str], start: datetime, end: datetime, interval: str) -> Sequence[MetricSeries]:
        def query(session: Session):
            result = []
            for metric in metrics:
                context = self._context(session, facility_id, metric)
                if context is None:
                    continue
                _link, station, definition, source, station_context = context
                if interval == "raw":
                    rows = session.scalars(select(EnvironmentalObservation).where(
                        EnvironmentalObservation.station_id == station.id,
                        EnvironmentalObservation.metric_key == metric,
                        EnvironmentalObservation.visibility == "PUBLIC",
                        EnvironmentalObservation.observed_at >= start.isoformat(),
                        EnvironmentalObservation.observed_at <= end.isoformat(),
                    ).order_by(EnvironmentalObservation.observed_at)).all()
                    points = tuple(SeriesPoint(
                        _dt(row.observed_at), row.value if row.value is not None else row.category_value,
                        sample_count=1 if row.missing_reason is None else 0,
                        coverage_fraction=1.0 if row.missing_reason is None else 0.0,
                        quality_flags=tuple(row.quality_flags),
                        original_value=row.original_value if row.original_value is not None else row.original_category_value,
                        original_unit=row.original_unit,
                    ) for row in rows if row.observed_at)
                    valid = sum(point.value is not None for point in points)
                    coverage = valid / len(points) if points else 0.0
                    retrieved = max((_dt(row.retrieved_at) for row in rows), default=self._clock())
                    quality = rows[-1].quality if rows else "unknown"
                    status = "AVAILABLE" if coverage == 1 else ("PARTIAL" if points else "UNKNOWN")
                else:
                    rows = session.scalars(select(EnvironmentalRollup).where(
                        EnvironmentalRollup.station_id == station.id,
                        EnvironmentalRollup.metric_key == metric,
                        EnvironmentalRollup.interval == interval,
                        EnvironmentalRollup.bucket_start >= start.isoformat(),
                        EnvironmentalRollup.bucket_start <= end.isoformat(),
                    ).order_by(EnvironmentalRollup.bucket_start)).all()
                    points = tuple(SeriesPoint(
                        _dt(row.bucket_start), row.total if definition.preferred_aggregation == "sum" else (row.value if row.value is not None else row.latest),
                        row.minimum, row.maximum, row.sample_count, row.coverage_fraction,
                        tuple(row.quality_flags),
                    ) for row in rows)
                    valid = sum(row.valid_sample_count for row in rows)
                    expected = sum(row.expected_sample_count for row in rows)
                    coverage = valid / expected if expected else 0.0
                    retrieved = self._clock()
                    quality = rows[-1].quality if rows else "unknown"
                    status = "AVAILABLE" if coverage == 1 else ("PARTIAL" if rows else "UNKNOWN")
                result.append(MetricSeries(
                    metric, definition.display_name, definition.canonical_unit, status, quality,
                    coverage, len(points) if interval == "raw" else sum(row.expected_sample_count for row in rows),
                    valid, station_context, self._provenance(source, retrieved), points, CONTEXT_NOTICE,
                ))
            return result
        return self._execute(query)

    def state_summary(self, state_code: str, metrics: Sequence[str], range_key: str) -> StateSummary:
        def query(session: Session):
            facility_ids = tuple(session.scalars(select(PublicFacilityRecord.id).join(
                PublicFacilitySnapshot, PublicFacilitySnapshot.facility_id == PublicFacilityRecord.id,
            ).where(
                PublicFacilityRecord.state_code == state_code,
                PublicFacilitySnapshot.is_current.is_(True),
                PublicFacilitySnapshot.visibility == "PUBLIC",
            )).all())
            summaries = []
            covered_ids = set()
            for metric in metrics:
                items = []
                for facility_id in facility_ids:
                    facility_items = list(self.current_metrics(facility_id, [metric]))
                    if facility_items:
                        covered_ids.add(facility_id)
                        items.extend(facility_items)
                values = [float(item.value) for item in items if isinstance(item.value, (int, float))]
                current = sum(item.availability in ("AVAILABLE", "PARTIAL") for item in items)
                stale = sum(item.availability == "STALE" for item in items)
                unavailable = len(facility_ids) - len(items)
                summaries.append(StateMetricSummary(
                    metric, metric.replace("_", " ").title(), items[0].unit if items else "",
                    "AVAILABLE" if unavailable == 0 else ("PARTIAL" if items else "NOT_COVERED"),
                    len(items), current, stale, unavailable,
                    min(values) if values else None, max(values) if values else None,
                    fmean(values) if values else None, "facility_context_mean",
                    "Summary of nearby public stations linked to facilities; not facility-caused pollution.",
                ))
            sources = tuple(SourceHealth(row.id, row.runtime_status, _dt(row.last_checked_at), _dt(row.last_success_at)) for row in session.scalars(select(DataSource)).all())
            return StateSummary(state_code, range_key, self._clock(), len(facility_ids), len(covered_ids), tuple(summaries), sources)
        return self._execute(query)

