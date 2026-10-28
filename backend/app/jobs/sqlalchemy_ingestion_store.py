"""SQLite persistence for operational connector jobs."""
from __future__ import annotations

import gzip
import hashlib
from collections.abc import Callable, Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from ..data.connectors.operational import HttpResponse, OperationalObservation
from ..data.models import DataSource, IngestionRun, RawSnapshot
from ..models.environmental import EnvironmentalObservation, MonitoringStation


class IngestionPersistenceError(RuntimeError):
    pass


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class SqlAlchemyIngestionStore:
    def __init__(self, session_factory: Callable[[], Session], raw_root: Path) -> None:
        self._session_factory = session_factory
        self._raw_root = raw_root.expanduser().resolve()

    def start_run(self, source_id: str, parser_version: str, started_at: datetime) -> str:
        run_id = str(uuid4())
        with self._session_factory() as session, session.begin():
            if session.get(DataSource, source_id) is None:
                raise IngestionPersistenceError(f"Data source {source_id!r} is not registered")
            session.add(IngestionRun(
                id=run_id, source_id=source_id, started_at=_iso(started_at), status="failed",
                parser_version=parser_version,
            ))
        return run_id

    def save_raw_snapshot(self, run_id: str, response: HttpResponse) -> str:
        digest = hashlib.sha256(response.content).hexdigest()
        run_day = response.fetched_at.astimezone(timezone.utc).strftime("%Y-%m-%d")
        destination = self._raw_root / run_day / f"{digest}.bin.gz"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            temporary = destination.with_suffix(".tmp")
            temporary.write_bytes(gzip.compress(response.content))
            temporary.replace(destination)
        snapshot_id = str(uuid4())
        relative_path = destination.relative_to(self._raw_root).as_posix()
        with self._session_factory() as session, session.begin():
            run = session.get(IngestionRun, run_id)
            if run is None:
                raise IngestionPersistenceError("Ingestion run does not exist")
            session.add(RawSnapshot(
                id=snapshot_id, source_id=run.source_id, run_id=run_id, path=relative_path,
                sha256=digest, content_type=response.content_type, fetched_at=_iso(response.fetched_at),
            ))
            run.http_status = response.status_code
            run.bytes = len(response.content)
            run.sha256 = digest
        return snapshot_id

    def save_observations(
        self, run_id: str, raw_snapshot_id: str, observations: Sequence[OperationalObservation],
    ) -> int:
        inserted = 0
        with self._session_factory() as session, session.begin():
            for item in observations:
                if item.longitude is None or item.latitude is None:
                    raise IngestionPersistenceError("A new monitoring station requires public coordinates")
                station_id = f"{item.source_id}:{item.native_station_id}"
                station_values = {
                    "id": station_id, "source_id": item.source_id,
                    "native_station_id": item.native_station_id, "name": item.station_name,
                    "provider": item.source_id, "public_longitude": item.longitude,
                    "public_latitude": item.latitude, "station_type": item.station_type,
                    "measured_metrics": [item.metric_key], "status": "ACTIVE",
                    "last_seen_at": _iso(item.observed_at), "metadata_json": {},
                    "visibility": "PUBLIC", "created_at": _iso(item.retrieved_at),
                    "updated_at": _iso(item.retrieved_at),
                }
                session.execute(insert(MonitoringStation).values(**station_values).on_conflict_do_update(
                    index_elements=["source_id", "native_station_id"],
                    set_={
                        "name": item.station_name, "public_longitude": item.longitude,
                        "public_latitude": item.latitude, "station_type": item.station_type,
                        "last_seen_at": _iso(item.observed_at), "updated_at": _iso(item.retrieved_at),
                    },
                ))
                values = {
                    "id": str(uuid4()), "source_id": item.source_id, "station_id": station_id,
                    "facility_id": None, "metric_key": item.metric_key, "ingestion_run_id": run_id,
                    "raw_snapshot_id": raw_snapshot_id, "value": item.value,
                    "category_value": None, "canonical_unit": item.canonical_unit,
                    "original_value": item.original_value, "original_category_value": None,
                    "original_unit": item.original_unit,
                    "status": "AVAILABLE" if item.value is not None else "UNKNOWN",
                    "quality": item.quality, "evidence_class": "MEASURED",
                    "temporal_class": "NEAR_REAL_TIME", "visibility": "PUBLIC",
                    "observed_at": _iso(item.observed_at), "published_at": None,
                    "retrieved_at": _iso(item.retrieved_at), "quality_flags": list(item.quality_flags),
                    "missing_reason": item.missing_reason,
                    "provider_dedupe_key": item.provider_dedupe_key,
                    "created_at": _iso(item.retrieved_at),
                }
                result = session.execute(insert(EnvironmentalObservation).values(**values).on_conflict_do_nothing(
                    index_elements=["source_id", "provider_dedupe_key"]
                ))
                inserted += max(result.rowcount or 0, 0)
        return inserted

    def finish_run(self, run_id: str, status: str, finished_at: datetime, error: str | None = None) -> None:
        with self._session_factory() as session, session.begin():
            run = session.get(IngestionRun, run_id)
            if run is None:
                raise IngestionPersistenceError("Ingestion run does not exist")
            run.status = status
            run.finished_at = _iso(finished_at)
            run.error = error
            source = session.get(DataSource, run.source_id)
            source.last_checked_at = _iso(finished_at)
            if status in ("success", "partial"):
                source.runtime_status = "CONNECTED"
                source.last_success_at = _iso(finished_at)

    def mark_source_stale(self, source_id: str, checked_at: datetime) -> None:
        with self._session_factory() as session, session.begin():
            source = session.get(DataSource, source_id)
            if source is None:
                raise IngestionPersistenceError(f"Data source {source_id!r} is not registered")
            source.runtime_status = "STALE"
            source.last_checked_at = _iso(checked_at)

