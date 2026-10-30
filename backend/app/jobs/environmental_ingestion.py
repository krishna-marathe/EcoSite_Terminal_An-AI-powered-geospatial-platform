"""Provider-neutral ingestion orchestration with persistence interfaces."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from ..data.connectors.operational import OperationalConnector


class IngestionStore(Protocol):
    def start_run(self, source_id: str, parser_version: str, started_at: datetime) -> str: ...
    def save_raw_snapshot(self, run_id: str, response) -> str: ...
    def save_observations(self, run_id: str, raw_snapshot_id: str, observations) -> int: ...
    def finish_run(self, run_id: str, status: str, finished_at: datetime, error: str | None = None) -> None: ...
    def mark_source_stale(self, source_id: str, checked_at: datetime) -> None: ...


@dataclass(frozen=True)
class JobResult:
    run_id: str
    source_id: str
    status: str
    observation_count: int


def run_connector(connector: OperationalConnector, store: IngestionStore) -> JobResult:
    started_at = datetime.now(timezone.utc)
    run_id = store.start_run(connector.source_id, connector.parser_version, started_at)
    try:
        response = connector.fetch()
        raw_snapshot_id = store.save_raw_snapshot(run_id, response)
        observations = connector.parse(response)
        count = store.save_observations(run_id, raw_snapshot_id, observations)
        status = "success" if count == len(observations) else "partial"
        store.finish_run(run_id, status, datetime.now(timezone.utc))
        return JobResult(run_id, connector.source_id, status, count)
    except Exception as error:
        store.mark_source_stale(connector.source_id, datetime.now(timezone.utc))
        store.finish_run(run_id, "failed", datetime.now(timezone.utc), type(error).__name__)
        raise

