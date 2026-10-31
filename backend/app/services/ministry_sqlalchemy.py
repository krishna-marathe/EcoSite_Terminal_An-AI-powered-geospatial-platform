"""SQLAlchemy queries for ministry operational queues."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..data.models import DataSource, IngestionRun
from ..models.environmental import EnvironmentalObservation, FacilityStationLink, MetricDefinition
from ..models.public_registry import PublicFacilityRecord, PublicFacilitySnapshot
from .ministry_operations import (
    FacilityFreshness, MinistryOperationsRepository, MinistrySourceHealth,
    MinistryStateSummary,
)


class MinistryStorageError(RuntimeError): pass


def _dt(value):
    if not value: return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class SqlAlchemyMinistryOperationsRepository(MinistryOperationsRepository):
    def __init__(self, session_factory: Callable[[], Session], clock=lambda: datetime.now(timezone.utc)) -> None:
        self._session_factory = session_factory; self._clock = clock

    def _run(self, callback):
        try:
            with self._session_factory() as session: return callback(session)
        except SQLAlchemyError as error:
            raise MinistryStorageError("Ministry operational storage is unavailable") from error

    def _published(self, session):
        return session.execute(select(PublicFacilityRecord.id, PublicFacilityRecord.name, PublicFacilityRecord.state_code).join(
            PublicFacilitySnapshot, PublicFacilitySnapshot.facility_id == PublicFacilityRecord.id,
        ).where(PublicFacilitySnapshot.is_current.is_(True), PublicFacilitySnapshot.visibility == "PUBLIC")).all()

    def facility_freshness(self):
        def query(session):
            result = []
            for facility_id, name, state_code in self._published(session):
                links = session.scalars(select(FacilityStationLink).where(
                    FacilityStationLink.facility_id == facility_id, FacilityStationLink.is_primary.is_(True),
                )).all()
                if not links:
                    result.append(FacilityFreshness(facility_id, name, state_code, "all", "not_covered", None, None, None, "no linked station"))
                for link in links:
                    definition = session.get(MetricDefinition, link.metric_key)
                    observation = session.scalar(select(EnvironmentalObservation).where(
                        EnvironmentalObservation.station_id == link.station_id,
                        EnvironmentalObservation.metric_key == link.metric_key,
                        EnvironmentalObservation.visibility == "PUBLIC",
                    ).order_by(EnvironmentalObservation.observed_at.desc()).limit(1))
                    if observation is None:
                        result.append(FacilityFreshness(facility_id, name, state_code, link.metric_key, "unavailable", None, None, None, "no observation")); continue
                    observed = _dt(observation.observed_at)
                    age = int((self._clock() - observed).total_seconds()) if observed else None
                    status = "stale" if age is None or definition is None or age > definition.stale_after_seconds else "current"
                    if observation.status == "SOURCE_UNAVAILABLE": status = "unavailable"
                    result.append(FacilityFreshness(facility_id, name, state_code, link.metric_key, status, observed, age, observation.source_id, observation.missing_reason))
            return result
        return self._run(query)

    def state_summaries(self):
        freshness = self.facility_freshness()
        return self._run(lambda session: self._state_rows(session, freshness))

    def _state_rows(self, session, freshness):
        by_state = defaultdict(list)
        for row in self._published(session): by_state[row.state_code].append(row.id)
        result = []
        for state, facilities in by_state.items():
            statuses = {facility: [item.status for item in freshness if item.facility_id == facility] for facility in facilities}
            current = 0
            stale = 0
            unavailable = 0
            for values in statuses.values():
                if not values or all(s in ("unavailable", "not_covered") for s in values):
                    unavailable += 1
                elif any(s == "stale" for s in values):
                    stale += 1
                elif any(s == "current" for s in values):
                    current += 1
                else:
                    unavailable += 1
            result.append(MinistryStateSummary(state, len(facilities), current, stale, unavailable))
        return result

    def source_health(self):
        def query(session):
            result = []
            freshness_list = self.facility_freshness()
            for source in session.scalars(select(DataSource)).all():
                failures = session.scalar(select(func.count()).select_from(IngestionRun).where(
                    IngestionRun.source_id == source.id, IngestionRun.status == "failed"
                )) or 0
                stale = len({row.facility_id for row in freshness_list if row.source_id == source.id and row.status == "stale"})
                result.append(MinistrySourceHealth(source.id, source.provider, source.runtime_status, _dt(source.last_checked_at), _dt(source.last_success_at), stale, failures))
            return result
        return self._run(query)

