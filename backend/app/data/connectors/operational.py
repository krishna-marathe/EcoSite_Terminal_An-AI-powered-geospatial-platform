"""Provider-neutral contracts for cached operational environmental feeds."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx


class ConnectorNotConfigured(RuntimeError):
    pass


class OperationalConnectorError(RuntimeError):
    pass


@dataclass(frozen=True)
class HttpResponse:
    url: str
    status_code: int
    content_type: str
    content: bytes
    fetched_at: datetime


class HttpTransport(Protocol):
    def get(self, url: str, *, params: dict[str, str], headers: dict[str, str], timeout: float) -> HttpResponse: ...


class HttpxTransport:
    def get(self, url: str, *, params: dict[str, str], headers: dict[str, str], timeout: float) -> HttpResponse:
        try:
            with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
                response = client.get(url, params=params)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise OperationalConnectorError("Provider request failed") from error
        return HttpResponse(
            url=str(response.url), status_code=response.status_code,
            content_type=response.headers.get("content-type", "application/octet-stream"),
            content=response.content, fetched_at=datetime.now(timezone.utc),
        )


@dataclass(frozen=True)
class OperationalObservation:
    source_id: str
    native_station_id: str
    station_name: str
    metric_key: str
    value: float | None
    canonical_unit: str
    original_value: float | None
    original_unit: str
    observed_at: datetime
    retrieved_at: datetime
    provider_dedupe_key: str
    quality: str = "preliminary"
    quality_flags: tuple[str, ...] = ()
    missing_reason: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    station_type: str = "unknown"


class OperationalConnector(Protocol):
    source_id: str
    parser_version: str
    def fetch(self) -> HttpResponse: ...
    def parse(self, response: HttpResponse) -> list[OperationalObservation]: ...


def parse_utc(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise OperationalConnectorError("Provider timestamp has no timezone")
    return parsed.astimezone(timezone.utc)

