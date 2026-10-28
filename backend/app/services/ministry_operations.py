"""Ministry operational queues over repository-provided public facts."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Protocol, Sequence


FreshnessStatus = Literal["current", "stale", "unavailable", "not_covered"]


@dataclass(frozen=True)
class FacilityFreshness:
    facility_id: str
    facility_name: str
    state_code: str
    metric: str
    status: FreshnessStatus
    observed_at: datetime | None
    age_seconds: int | None
    source_id: str | None
    reason: str | None = None


@dataclass(frozen=True)
class MinistrySourceHealth:
    source_id: str
    provider: str
    status: str
    last_checked_at: datetime | None
    last_success_at: datetime | None
    stale_facility_count: int
    failed_run_count: int


@dataclass(frozen=True)
class MinistryStateSummary:
    state_code: str
    facility_count: int
    current_facility_count: int
    stale_facility_count: int
    unavailable_facility_count: int


@dataclass(frozen=True)
class MinistryOverview:
    generated_at: datetime
    facility_count: int
    states: tuple[MinistryStateSummary, ...]
    source_health: tuple[MinistrySourceHealth, ...]
    freshness_queue: tuple[FacilityFreshness, ...]


class MinistryOperationsRepository(Protocol):
    def state_summaries(self) -> Sequence[MinistryStateSummary]: ...
    def source_health(self) -> Sequence[MinistrySourceHealth]: ...
    def facility_freshness(self) -> Sequence[FacilityFreshness]: ...


class MinistryOperationsService:
    def __init__(self, repository: MinistryOperationsRepository, clock=lambda: datetime.now(timezone.utc)) -> None:
        self._repository = repository
        self._clock = clock

    def overview(self, queue_limit: int = 100) -> MinistryOverview:
        if not 1 <= queue_limit <= 500:
            raise ValueError("queue_limit must be between 1 and 500")
        states = tuple(sorted(self._repository.state_summaries(), key=lambda row: row.state_code))
        sources = tuple(sorted(self._repository.source_health(), key=lambda row: (row.status, row.provider)))
        priority = {"unavailable": 0, "stale": 1, "not_covered": 2, "current": 3}
        queue = tuple(sorted(
            self._repository.facility_freshness(),
            key=lambda row: (priority[row.status], -(row.age_seconds or 0), row.facility_id, row.metric),
        )[:queue_limit])
        return MinistryOverview(self._clock(), sum(row.facility_count for row in states), states, sources, queue)

    def state_summaries(self) -> tuple[MinistryStateSummary, ...]:
        return tuple(sorted(self._repository.state_summaries(), key=lambda row: row.state_code))

    def source_health(self) -> tuple[MinistrySourceHealth, ...]:
        return tuple(sorted(self._repository.source_health(), key=lambda row: (row.status, row.provider)))

    def freshness_queue(self, limit: int = 100) -> tuple[FacilityFreshness, ...]:
        return self.overview(limit).freshness_queue

