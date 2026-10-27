"""Ingestion orchestration: fetch, snapshot, parse and persist observations.

A failed run is recorded and committed rather than raised away. The caller maps the
returned status to an HTTP response; the database keeps the evidence of the attempt.
"""
from __future__ import annotations

import gzip
import hashlib
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .connectors import CONNECTORS
from .connectors.base import Connector, ConnectorUnavailable, FetchRequest, ParsedRecord, RawPayload, validate_records
from .models import DataSource, IngestionRun, Observation, RawSnapshot

ROOT = Path(__file__).resolve().parents[2]
TEST_STATUS_RANK = {
    "DISCOVERED": 0,
    "ACCESS_TESTED": 1,
    "PROCESSING_TESTED": 2,
    "VALIDATED": 3,
    "INTEGRATED": 4,
}
SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass
class IngestionResult:
    source_id: str
    run_id: str
    status: str
    error: str | None
    records: list[ParsedRecord] = field(default_factory=list)
    observation_ids: list[str] = field(default_factory=list)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def raw_root() -> Path:
    return Path(os.getenv("ECOSITE_RAW_DIR", str(ROOT / "data" / "raw"))).expanduser().resolve()


def _safe_name(value: str) -> str:
    cleaned = SAFE_FILENAME.sub("_", value).strip("._")
    return cleaned or "payload"


def _payload_sha256(payloads: list[RawPayload]) -> str:
    digest = hashlib.sha256()
    for payload in payloads:
        digest.update(payload.content)
    return digest.hexdigest()


def _store_snapshot(payload: RawPayload, run_id: str, fetched_at: str, root: Path, index: int) -> RawSnapshot:
    day = fetched_at[:10]
    directory = root / payload.source_id / day
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{run_id}-{index:02d}-{_safe_name(payload.filename)}.gz"
    path = directory / filename
    with gzip.open(path, "wb") as handle:
        handle.write(payload.content)
    return RawSnapshot(
        source_id=payload.source_id,
        run_id=run_id,
        path=path.relative_to(root).as_posix(),
        sha256=hashlib.sha256(payload.content).hexdigest(),
        content_type=payload.content_type,
        fetched_at=fetched_at,
    )


def _dedupe_key(source_id: str, request: FetchRequest, record: ParsedRecord) -> str:
    parts = [
        source_id,
        request.site_id or "",
        record.indicator,
        record.period_start or "",
        record.period_end or "",
        record.processing_version,
        request.geometry_hash,
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _upsert_observation(
    session: Session,
    *,
    source_id: str,
    request: FetchRequest,
    record: ParsedRecord,
    snapshot_id: str | None,
    retrieved_at: str,
) -> str:
    key = _dedupe_key(source_id, request, record)
    existing = session.scalar(select(Observation).where(Observation.dedupe_key == key))
    values = {
        "source_id": source_id,
        "site_id": request.site_id,
        "geometry_hash": request.geometry_hash,
        "indicator": record.indicator,
        "value": record.value,
        "unit": record.unit,
        "status": record.status,
        "evidence_class": record.evidence_class,
        "dataset_version": record.dataset_version,
        "period_start": record.period_start,
        "period_end": record.period_end,
        "observed_at": record.observed_at,
        "published_at": record.published_at,
        "retrieved_at": retrieved_at,
        "resolution": record.resolution,
        "method": record.method,
        "processing_version": record.processing_version,
        "coverage_fraction": record.coverage_fraction,
        "quality_flags": record.quality_flags,
        "missing_reason": record.missing_reason,
        "raw_snapshot_id": snapshot_id,
        "dedupe_key": key,
    }
    if existing is None:
        observation = Observation(**values)
        session.add(observation)
        session.flush()
        return observation.id
    for key_name, value in values.items():
        setattr(existing, key_name, value)
    session.flush()
    return existing.id


def _advance_test_status(source: DataSource, candidate: str) -> None:
    if TEST_STATUS_RANK[candidate] > TEST_STATUS_RANK.get(source.test_status, 0):
        source.test_status = candidate


def run_ingestion(
    session: Session,
    source_id: str,
    request: FetchRequest,
    *,
    connector: Connector | None = None,
    raw_dir: Path | None = None,
) -> IngestionResult:
    connector = connector or CONNECTORS.get(source_id)
    if connector is None:
        raise ValueError(f"Source {source_id!r} has no implemented connector.")
    source = session.get(DataSource, source_id)
    if source is None:
        raise ValueError(f"Source {source_id!r} is not registered.")

    started_at = utc_now()
    run = IngestionRun(
        source_id=source_id,
        started_at=started_at,
        status="failed",
        parser_version=connector.parser_version,
    )
    session.add(run)
    session.flush()

    try:
        payloads = connector.fetch(request)
        if not payloads:
            raise ConnectorUnavailable("Connector fetched no payloads.")
        root = (raw_dir or raw_root()).expanduser().resolve()
        snapshots = [
            _store_snapshot(payload, run.id, payload.fetched_at, root, index)
            for index, payload in enumerate(payloads)
        ]
        session.add_all(snapshots)
        session.flush()
        snapshot_ids = [snapshot.id for snapshot in snapshots]

        records = connector.parse(payloads, request)
        validate_records(records)

        retrieved_at = utc_now()
        observation_ids = [
            _upsert_observation(
                session,
                source_id=source_id,
                request=request,
                record=record,
                snapshot_id=snapshot_ids[0] if snapshot_ids else None,
                retrieved_at=retrieved_at,
            )
            for record in records
        ]

        any_available = any(record.status == "AVAILABLE" for record in records)
        run.status = "success" if any_available else "partial"
        run.finished_at = utc_now()
        run.http_status = payloads[-1].http_status
        run.bytes = sum(len(payload.content) for payload in payloads)
        run.sha256 = _payload_sha256(payloads)
        run.error = None
        source.runtime_status = "CONNECTED"
        source.last_checked_at = run.finished_at
        source.last_success_at = run.finished_at
        source.updated_at = run.finished_at
        _advance_test_status(source, "PROCESSING_TESTED")
        session.flush()
        return IngestionResult(
            source_id=source_id,
            run_id=run.id,
            status=run.status,
            error=None,
            records=records,
            observation_ids=observation_ids,
        )
    except Exception as error:  # Recorded deliberately; never silently swallowed.
        finished_at = utc_now()
        message = str(error) or type(error).__name__
        run.status = "failed"
        run.finished_at = finished_at
        run.error = message[:2000]
        source.runtime_status = "SOURCE_UNAVAILABLE"
        source.last_checked_at = finished_at
        source.updated_at = finished_at
        session.flush()
        return IngestionResult(
            source_id=source_id,
            run_id=run.id,
            status="failed",
            error=message,
        )
