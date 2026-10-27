"""Shared contract for source connectors.

A connector fetches bytes and parses them into observations. It never computes a
score, never invents a missing value, and never substitutes synthetic data for a
failed source. Raster work is delegated to ``raster.py``; persistence is handled
by ``ingest.py``.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from ..models import EVIDENCE_CLASSES, OBSERVATION_STATUSES

USER_AGENT = "EcoSite-Terminal/0.1 (sustainability screening; contact: local operator)"
DEFAULT_TIMEOUT_S = 120.0
DEFAULT_MAX_TILES = 4


class ConnectorUnavailable(RuntimeError):
    """The source cannot be reached, authenticated, or parsed safely."""


@dataclass(frozen=True)
class FetchRequest:
    geometry: dict[str, Any]
    geometry_hash: str
    site_id: str | None = None
    buffer_m: float = 1000.0
    timeout_s: float = DEFAULT_TIMEOUT_S
    max_tiles: int = DEFAULT_MAX_TILES
    max_pages: int = 3


@dataclass(frozen=True)
class RawPayload:
    source_id: str
    url: str
    content: bytes
    content_type: str
    http_status: int
    fetched_at: str
    filename: str
    dataset_version: str
    is_live: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ParsedRecord:
    indicator: str
    value: float | None
    unit: str
    status: str
    evidence_class: str
    dataset_version: str
    period_start: str | None
    period_end: str | None
    observed_at: str | None
    published_at: str | None
    resolution: str
    method: str
    processing_version: str
    coverage_fraction: float | None
    quality_flags: dict[str, Any] = field(default_factory=dict)
    missing_reason: str | None = None


class Connector(Protocol):
    source_id: str
    parser_version: str

    def fetch(self, request: FetchRequest) -> list[RawPayload]: ...

    def parse(self, payloads: list[RawPayload], request: FetchRequest) -> list[ParsedRecord]: ...


def http_get(
    url: str,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    headers: dict[str, str] | None = None,
    attempts: int = 2,
) -> tuple[bytes, str, int]:
    """Fetch bytes with an explicit timeout and bounded retries.

    A 4xx is never retried. A timeout, transport error or 5xx is retried once and
    then surfaced as ``ConnectorUnavailable``.
    """
    last_error = "unknown error"
    request_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    for _ in range(max(1, attempts)):
        try:
            with httpx.Client(follow_redirects=True, timeout=timeout_s, headers=request_headers) as client:
                response = client.get(url)
            if 400 <= response.status_code < 500:
                raise ConnectorUnavailable(f"HTTP {response.status_code} for {url}; access is not authorised or the resource moved.")
            if response.status_code >= 500:
                last_error = f"HTTP {response.status_code}"
                continue
            return response.content, response.headers.get("content-type", "application/octet-stream"), response.status_code
        except ConnectorUnavailable:
            raise
        except (httpx.TimeoutException, httpx.TransportError) as error:
            last_error = f"{type(error).__name__}: {error}"
    raise ConnectorUnavailable(f"Request failed after retry: {last_error}")


def http_post_json(
    url: str,
    body: dict[str, Any],
    timeout_s: float = DEFAULT_TIMEOUT_S,
    headers: dict[str, str] | None = None,
    attempts: int = 2,
) -> tuple[bytes, str, int]:
    """POST a JSON body with the same retry rules as :func:`http_get`."""
    last_error = "unknown error"
    request_headers = {"User-Agent": USER_AGENT, "Content-Type": "application/json", **(headers or {})}
    for _ in range(max(1, attempts)):
        try:
            with httpx.Client(follow_redirects=True, timeout=timeout_s, headers=request_headers) as client:
                response = client.post(url, json=body)
            if 400 <= response.status_code < 500:
                raise ConnectorUnavailable(f"HTTP {response.status_code} for {url}; access is not authorised or the request was rejected.")
            if response.status_code >= 500:
                last_error = f"HTTP {response.status_code}"
                continue
            return response.content, response.headers.get("content-type", "application/octet-stream"), response.status_code
        except ConnectorUnavailable:
            raise
        except (httpx.TimeoutException, httpx.TransportError) as error:
            last_error = f"{type(error).__name__}: {error}"
    raise ConnectorUnavailable(f"Request failed after retry: {last_error}")


def validate_records(records: list[ParsedRecord]) -> None:
    if not records:
        raise ConnectorUnavailable("Connector produced no observations.")
    for record in records:
        if not record.indicator.strip():
            raise ConnectorUnavailable("Observation is missing an indicator.")
        if not record.unit.strip():
            raise ConnectorUnavailable(f"{record.indicator} is missing a unit.")
        if record.value is None and not record.missing_reason:
            raise ConnectorUnavailable(f"{record.indicator} has neither a value nor a missing-data reason.")
        if record.value is not None and not math.isfinite(record.value):
            raise ConnectorUnavailable(f"{record.indicator} has a non-finite value.")
        if record.coverage_fraction is not None and not 0 <= record.coverage_fraction <= 1:
            raise ConnectorUnavailable(f"{record.indicator} has coverage outside 0..1.")
        if record.status not in OBSERVATION_STATUSES:
            raise ConnectorUnavailable(f"{record.indicator} has an unknown status {record.status!r}.")
        if record.evidence_class not in EVIDENCE_CLASSES:
            raise ConnectorUnavailable(f"{record.indicator} has an unknown evidence class {record.evidence_class!r}.")
        if not record.dataset_version.strip() or not record.processing_version.strip():
            raise ConnectorUnavailable(f"{record.indicator} is missing a dataset or processing version.")
