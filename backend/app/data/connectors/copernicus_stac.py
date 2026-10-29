"""Copernicus Sentinel-2 STAC scene-metadata connector.

The connector performs a polygon search against the Copernicus Data Space
Ecosystem STAC API and summarises scene availability: how many scenes matched,
how many are below the cloud-cover threshold, the cloud-cover distribution and
how old the latest scene is.

It deliberately does **not** download pixels. Asset download requires a CDSE
account, and scene discovery is not a land-cover measurement. NDVI is added only
after authenticated asset access and cloud masking are verified. Until then the
land sub-score has scene context, not a vegetation measurement.
"""
from __future__ import annotations

import json
import os
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from .base import (
    ConnectorUnavailable,
    FetchRequest,
    ParsedRecord,
    RawPayload,
    http_get,
    http_post_json,
    validate_records,
)

SOURCE_ID = "copernicus_stac"
PARSER_VERSION = "1.0.0"
COLLECTION = "sentinel-2-l2a"
DATASET_VERSION = "Sentinel-2 L2A (rolling)"
RESOLUTION = "10 m / 20 m / 60 m"
METHOD = "stac_scene_metadata_summary"
EVIDENCE_CLASS = "REMOTE_SENSING_DERIVED"
DEFAULT_SEARCH_URL = "https://stac.opensearch.dataspace.copernicus.eu/v1/search"
DEFAULT_LOOKBACK_DAYS = 365
DEFAULT_MAX_CLOUD = 20.0
PAGE_LIMIT = 100


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except ValueError as error:
        raise ConnectorUnavailable(f"{name} is not a number: {raw!r}") from error
    if not minimum <= value <= maximum:
        raise ConnectorUnavailable(f"{name} must be between {minimum:g} and {maximum:g}.")
    return value


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise ConnectorUnavailable(f"{name} is not an integer: {raw!r}") from error
    if not minimum <= value <= maximum:
        raise ConnectorUnavailable(f"{name} must be between {minimum} and {maximum}.")
    return value


def _search_url() -> str:
    return os.getenv("ECOSITE_STAC_SEARCH_URL", DEFAULT_SEARCH_URL)


def _lookback_days() -> int:
    return _env_int("ECOSITE_STAC_LOOKBACK_DAYS", DEFAULT_LOOKBACK_DAYS, 1, 1825)


def _max_cloud() -> float:
    return _env_float("ECOSITE_STAC_MAX_CLOUD", DEFAULT_MAX_CLOUD, 0.0, 100.0)


def _search_window() -> tuple[str, str]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=_lookback_days())
    return (
        start.strftime("%Y-%m-%dT00:00:00Z"),
        end.strftime("%Y-%m-%dT23:59:59Z"),
    )


def _search_body(request: FetchRequest, start: str, end: str) -> dict[str, Any]:
    return {
        "collections": [COLLECTION],
        "intersects": request.geometry,
        "datetime": f"{start}/{end}",
        "limit": PAGE_LIMIT,
    }


def _window_dates(search_datetime: Any) -> tuple[str | None, str | None]:
    """Split a STAC ``start/end`` interval into ISO dates.

    A zero-scene result still needs the window that produced it, otherwise the
    absence of scenes cannot be reproduced or told apart from a failed search.
    """
    if not isinstance(search_datetime, str) or "/" not in search_datetime:
        return None, None
    start_text, _, end_text = search_datetime.partition("/")
    start = _parse_datetime(start_text)
    end = _parse_datetime(end_text)
    return (
        start.date().isoformat() if start else None,
        end.date().isoformat() if end else None,
    )


def _json(content: bytes) -> dict[str, Any]:
    try:
        document = json.loads(content)
    except (ValueError, UnicodeDecodeError) as error:
        raise ConnectorUnavailable("STAC response is not valid JSON.") from error
    if not isinstance(document, dict) or not isinstance(document.get("features"), list):
        raise ConnectorUnavailable("STAC response is not a FeatureCollection.")
    return document


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _cloud_cover(feature: dict[str, Any]) -> float | None:
    value = feature.get("properties", {}).get("eo:cloud_cover")
    try:
        cloud = float(value)
    except (TypeError, ValueError):
        return None
    if not 0 <= cloud <= 100:
        return None
    return cloud


def _collect_features(payloads: list[RawPayload]) -> tuple[list[dict[str, Any]], int]:
    """Deduplicate scenes across pages; a scene may appear on a page boundary."""
    features: list[dict[str, Any]] = []
    seen: set[str] = set()
    pages = 0
    for payload in payloads:
        document = _json(payload.content)
        pages += 1
        for feature in document["features"]:
            if not isinstance(feature, dict):
                continue
            identifier = feature.get("id")
            if not isinstance(identifier, str) or not identifier:
                identifier = f"{feature.get('properties', {}).get('datetime', '')}|{len(features)}"
            if identifier in seen:
                continue
            seen.add(identifier)
            features.append(feature)
    return features, pages


def _records(
    features: list[dict[str, Any]],
    *,
    pages: int,
    fetched_at: datetime,
    max_cloud: float,
    search_url: str,
    search_datetime: str | None = None,
    lookback_days: int | None = None,
) -> list[ParsedRecord]:
    scene_times: list[tuple[datetime, str]] = []
    cloud_values: list[float] = []
    missing_cloud = 0
    missing_datetime = 0

    for feature in features:
        properties = feature.get("properties", {})
        moment = _parse_datetime(properties.get("datetime"))
        if moment is None:
            missing_datetime += 1
        else:
            scene_times.append((moment, str(feature.get("id", ""))))
        cloud = _cloud_cover(feature)
        if cloud is None:
            missing_cloud += 1
        else:
            cloud_values.append(cloud)

    total = len(features)
    usable = [cloud for cloud in cloud_values if cloud <= max_cloud]
    latest = max(scene_times) if scene_times else None
    earliest = min(scene_times) if scene_times else None
    latest_age_days = (fetched_at - latest[0]).total_seconds() / 86400 if latest else None
    span_days = (latest[0] - earliest[0]).total_seconds() / 86400 if latest and earliest else None

    if total == 0:
        cloud_status = "SOURCE_UNAVAILABLE"
        cloud_reason = "No Sentinel-2 L2A scenes matched the polygon and search window."
    elif not cloud_values:
        cloud_status = "PARTIAL"
        cloud_reason = "Matched scenes do not include eo:cloud_cover, so scene usability is unknown."
    else:
        cloud_status = "AVAILABLE"
        cloud_reason = None

    if total == 0:
        usable_fraction = None
        usable_reason = cloud_reason
    elif not cloud_values:
        usable_fraction = None
        usable_reason = cloud_reason
    else:
        usable_fraction = len(usable) / total
        usable_reason = None

    if latest is None:
        age_reason = "No scene date is available for the matched scenes."
    else:
        age_reason = None

    window_start, window_end = _window_dates(search_datetime)
    period_start = earliest[0].date().isoformat() if earliest else window_start
    period_end = latest[0].date().isoformat() if latest else window_end
    observed_at = latest[0].isoformat() if latest else None

    quality: dict[str, Any] = {
        "collection": COLLECTION,
        "search_url": search_url,
        "search_datetime": search_datetime,
        "pages": pages,
        "server_cloud_filter": False,
        "max_cloud_percent": max_cloud,
        "lookback_days": lookback_days if lookback_days is not None else _lookback_days(),
        "scenes_without_cloud_cover": missing_cloud,
        "scenes_without_datetime": missing_datetime,
        "latest_scene_id": latest[1] if latest else None,
        "earliest_scene_id": earliest[1] if earliest else None,
        "note": "Scene metadata only; no pixels were downloaded and no NDVI was computed.",
    }

    def record(
        indicator: str,
        value: float | None,
        unit: str,
        *,
        status: str = "AVAILABLE",
        missing_reason: str | None = None,
    ) -> ParsedRecord:
        return ParsedRecord(
            indicator=indicator,
            value=value,
            unit=unit,
            status=status,
            evidence_class=EVIDENCE_CLASS,
            dataset_version=DATASET_VERSION,
            period_start=period_start,
            period_end=period_end,
            observed_at=observed_at,
            published_at=None,
            resolution=RESOLUTION,
            method=METHOD,
            processing_version=PARSER_VERSION,
            coverage_fraction=None,
            quality_flags=quality,
            missing_reason=missing_reason,
        )

    return [
        record("sentinel2_scene_count", float(total), "scenes"),
        record(
            "sentinel2_usable_scene_count",
            float(len(usable)) if cloud_values else None,
            "scenes",
            status=cloud_status,
            missing_reason=usable_reason,
        ),
        record(
            "sentinel2_usable_scene_fraction",
            usable_fraction,
            "fraction",
            status=cloud_status,
            missing_reason=usable_reason,
        ),
        record(
            "sentinel2_cloud_cover_median_percent",
            float(statistics.median(cloud_values)) if cloud_values else None,
            "%",
            status=cloud_status,
            missing_reason=cloud_reason,
        ),
        record(
            "sentinel2_cloud_cover_min_percent",
            float(min(cloud_values)) if cloud_values else None,
            "%",
            status=cloud_status,
            missing_reason=cloud_reason,
        ),
        record(
            "sentinel2_latest_scene_age_days",
            latest_age_days,
            "days",
            status="AVAILABLE" if latest_age_days is not None else "PARTIAL",
            missing_reason=age_reason,
        ),
        record(
            "sentinel2_scene_date_span_days",
            span_days,
            "days",
            status="AVAILABLE" if span_days is not None else "PARTIAL",
            missing_reason=age_reason,
        ),
    ]


class CopernicusStacConnector:
    source_id = SOURCE_ID
    parser_version = PARSER_VERSION

    def fetch(self, request: FetchRequest) -> list[RawPayload]:
        fetched_at = datetime.now(timezone.utc).isoformat()
        search_url = _search_url()
        lookback_days = _lookback_days()
        start, end = _search_window()
        search_datetime = f"{start}/{end}"
        url = search_url
        body: dict[str, Any] | None = _search_body(request, start, end)
        payloads: list[RawPayload] = []
        for page in range(1, max(1, request.max_pages) + 1):
            if body is None:
                content, content_type, status = http_get(url, timeout_s=request.timeout_s)
            else:
                content, content_type, status = http_post_json(url, body, timeout_s=request.timeout_s)
            payloads.append(
                RawPayload(
                    source_id=SOURCE_ID,
                    url=url,
                    content=content,
                    content_type=content_type,
                    http_status=status,
                    fetched_at=fetched_at,
                    filename=f"stac-search-{page:02d}.json",
                    dataset_version=DATASET_VERSION,
                    metadata={
                        "search_datetime": search_datetime,
                        "search_url": search_url,
                        "lookback_days": lookback_days,
                    },
                )
            )
            document = _json(content)
            next_link = next(
                (link for link in document.get("links", []) if isinstance(link, dict) and link.get("rel") == "next"),
                None,
            )
            if not next_link or not next_link.get("href"):
                break
            url = str(next_link["href"])
            if str(next_link.get("method", "GET")).upper() == "POST":
                body = next_link.get("body") or body
            else:
                body = None
        return payloads

    def parse(self, payloads: list[RawPayload], request: FetchRequest) -> list[ParsedRecord]:
        features, pages = _collect_features(payloads)
        fetched_at = _parse_datetime(payloads[0].fetched_at) if payloads else None
        if fetched_at is None:
            fetched_at = datetime.now(timezone.utc)
        metadata = next((payload.metadata for payload in payloads if payload.metadata), {})
        search_datetime = metadata.get("search_datetime")
        lookback_days = metadata.get("lookback_days")
        records = _records(
            features,
            pages=pages,
            fetched_at=fetched_at,
            max_cloud=_max_cloud(),
            search_url=metadata.get("search_url") or _search_url(),
            search_datetime=search_datetime if isinstance(search_datetime, str) else None,
            lookback_days=lookback_days if isinstance(lookback_days, int) else None,
        )
        validate_records(records)
        return records
