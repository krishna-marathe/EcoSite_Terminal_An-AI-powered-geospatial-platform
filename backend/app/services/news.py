"""Provider-neutral media context for the data-centre dashboard.

News is context, never evidence: this module only normalises publicly linked
headlines, never article bodies, and never touches facility risk or publication
state. Provider credentials stay server-side and are never echoed in results.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from functools import lru_cache
from html import unescape
from pathlib import Path
from typing import Callable, Iterable, Mapping, Protocol, Sequence

from ..schemas.news import NewsItem

LOGGER = logging.getLogger(__name__)

CATALOG_PATH = Path(__file__).resolve().parents[3] / "data" / "news_topics.json"
REGIONS: tuple[str, ...] = ("india", "world")
MAX_ITEMS = 12
MAX_AGE_DAYS = 30
SUMMARY_LIMIT = 280
DEFAULT_TTL_SECONDS = 900
WEBZ_URL = "https://api.webz.io/newsApiLite"

_GOVERNMENT_HINTS = ("pib", "ministry", "government", "gov.", ".gov", "authority", "regulator", "commission")
_WIRE_HINTS = ("reuters", "pti", "ani", "bloomberg", "associated press", "afp", "ians")


class NewsError(RuntimeError):
    """Base class for news failures that must not be surfaced verbatim."""


class NewsProviderError(NewsError):
    """The upstream provider failed; details stay in the server log only."""


class NewsConfigurationError(NewsError):
    """No provider is configured for this deployment."""


class NewsQueryError(ValueError):
    """The requested region or topic is not part of the catalogue."""


@dataclass(frozen=True)
class RawNewsItem:
    title: str
    url: str
    publisher: str
    published_at: str | None
    summary: str = ""


@dataclass(frozen=True)
class NewsTopic:
    key: str
    label: str
    queries: Mapping[str, tuple[str, ...]]


@dataclass(frozen=True)
class FeedResult:
    region: str
    topic: str
    generated_at: datetime
    coverage: str
    provider: str
    items: tuple[NewsItem, ...]


class NewsProvider(Protocol):
    name: str
    configured: bool

    def fetch(self, query: str, region: str, limit: int) -> list[RawNewsItem]:
        """Return raw items for one query. Must raise NewsProviderError on failure."""


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _clean_text(value: str | None, limit: int) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", value or ""))
    text = " ".join(text.split())
    return text[:limit].rstrip()


def _parse_published(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    try:
        parsed = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed is None:
        return None
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def canonical_url(value: str) -> str | None:
    """Stable identity for a link: scheme-checked, tracking-free, case-normalised."""
    try:
        parsed = urllib.parse.urlsplit(value.strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    host = parsed.netloc.casefold()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/") or "/"
    return f"{host}{path}"


def title_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def _tokens(value: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", value.casefold()) if len(word) > 3}


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _publisher_tier(publisher: str) -> int:
    value = publisher.casefold()
    if any(hint in value for hint in _GOVERNMENT_HINTS):
        return 3
    if any(hint in value for hint in _WIRE_HINTS):
        return 2
    return 1


def _normalise(
    raw: RawNewsItem,
    *,
    region: str,
    topic: str,
    provider: str,
    retrieved_at: datetime,
) -> NewsItem | None:
    title = _clean_text(raw.title, 400)
    canonical = canonical_url(raw.url)
    published = _parse_published(raw.published_at)
    if not title or canonical is None or published is None:
        return None
    if published > retrieved_at + timedelta(days=1):
        # Provider clocks drift; never present a future publication time.
        published = retrieved_at
    if retrieved_at - published > timedelta(days=MAX_AGE_DAYS):
        return None
    publisher = _clean_text(raw.publisher, 200)
    if not publisher:
        publisher = (urllib.parse.urlsplit(raw.url).hostname or "").removeprefix("www.")
    if not publisher:
        return None
    if " - " in title:
        head, tail = title.rsplit(" - ", 1)
        if tail.strip().casefold() == publisher.casefold():
            title = head.strip()
    summary = _clean_text(raw.summary, SUMMARY_LIMIT) or None
    identifier = hashlib.sha1(f"{canonical}|{title_key(title)}".encode()).hexdigest()[:16]
    return NewsItem(
        id=identifier,
        title=title,
        url=raw.url.strip(),
        publisher=publisher,
        publishedAt=_iso(published),
        summary=summary,
        region=region,  # type: ignore[arg-type]
        topics=[topic],
        provider=provider,
        retrievedAt=_iso(retrieved_at),
    )


def dedupe_and_rank(items: Iterable[NewsItem], *, now: datetime, limit: int) -> list[NewsItem]:
    """Order by publisher tier and recency, dropping URL and headline duplicates."""
    def tier(item: NewsItem) -> int:
        return _publisher_tier(item.publisher)

    ordered = sorted(items, key=lambda item: (tier(item), item.publishedAt), reverse=True)

    kept: list[NewsItem] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    for item in ordered:
        canonical = canonical_url(item.url) or item.url
        key = title_key(item.title)
        if canonical in seen_urls or key in seen_titles:
            continue
        tokens = _tokens(item.title)
        if any(_jaccard(tokens, _tokens(existing.title)) >= 0.8 for existing in kept):
            continue
        seen_urls.add(canonical)
        seen_titles.add(key)
        kept.append(item)

    def score(item: NewsItem) -> float:
        published = _parse_published(item.publishedAt) or now
        age_hours = max(0.0, (now - published).total_seconds() / 3600)
        freshness = max(0.0, 1 - age_hours / (MAX_AGE_DAYS * 24))
        text = f"{item.title} {item.summary or ''}".casefold()
        focus = 2.0 if ("data cent" in text or "datacent" in text) else 0.0
        return _publisher_tier(item.publisher) * 10 + focus * 3 + freshness

    kept.sort(key=lambda item: (score(item), item.publishedAt), reverse=True)
    return kept[:limit]


@lru_cache(maxsize=4)
def load_catalog(path: str | Path = CATALOG_PATH) -> tuple[Mapping[str, NewsTopic], str]:
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    version = str(document.get("version") or "")
    topics: dict[str, NewsTopic] = {}
    for entry in document["topics"]:
        key = str(entry["key"]).strip().casefold()
        label = str(entry["label"]).strip()
        queries = {
            region: tuple(str(query).strip() for query in entry.get(region, []) if str(query).strip())
            for region in REGIONS
        }
        if not key or not label or not all(queries[region] for region in REGIONS):
            raise NewsConfigurationError(f"News topic {key or '<empty>'} needs a label and India/World queries")
        topics[key] = NewsTopic(key=key, label=label, queries=queries)
    if "all" not in topics:
        raise NewsConfigurationError("News topic catalogue must define 'all'")
    return topics, version


class DisabledNewsProvider:
    name = "disabled"
    configured = False

    def fetch(self, query: str, region: str, limit: int) -> list[RawNewsItem]:
        raise NewsConfigurationError("No news provider is configured")


class GoogleNewsRssProvider:
    """Keyless fallback: Google News RSS, links open the publisher via redirect."""

    name = "google-news-rss"
    configured = True
    _LOCALES = {"india": ("en-IN", "IN", "IN:en"), "world": ("en-US", "US", "US:en")}

    def __init__(self, timeout: float = 8.0, opener: Callable[..., object] | None = None) -> None:
        self._timeout = timeout
        self._opener = opener or urllib.request.urlopen

    def fetch(self, query: str, region: str, limit: int) -> list[RawNewsItem]:
        hl, gl, ceid = self._LOCALES.get(region, self._LOCALES["world"])
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
            {"q": query, "hl": hl, "gl": gl, "ceid": ceid}
        )
        request = urllib.request.Request(url, headers={"User-Agent": "EcoSiteAI/0.2 (+https://ecosite.ai)"})
        try:
            with self._opener(request, timeout=self._timeout) as response:  # type: ignore[attr-defined]
                body = response.read()
        except Exception as error:  # noqa: BLE001 - provider boundary
            raise NewsProviderError("news RSS request failed") from error

        try:
            root = ET.fromstring(body)
        except ET.ParseError as error:
            raise NewsProviderError("news RSS response was not valid XML") from error

        items: list[RawNewsItem] = []
        for node in root.findall("./channel/item")[: max(limit, 1) * 4]:
            source = node.find("source")
            items.append(
                RawNewsItem(
                    title=node.findtext("title") or "",
                    url=node.findtext("link") or "",
                    publisher=(source.text if source is not None else "") or "",
                    published_at=node.findtext("pubDate"),
                    summary=node.findtext("description") or "",
                )
            )
        return items


class WebzNewsProvider:
    """Webz.io News Search adapter. Disabled until a token is configured."""

    name = "webz.io"

    def __init__(self, token: str | None = None, timeout: float = 12.0) -> None:
        self._token = (token if token is not None else os.getenv("WEBZ_API_TOKEN", "")).strip()
        self._timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self._token)

    def fetch(self, query: str, region: str, limit: int) -> list[RawNewsItem]:
        if not self.configured:
            raise NewsConfigurationError("Webz.io news search requires WEBZ_API_TOKEN")
        try:
            import httpx

            with httpx.Client(timeout=self._timeout) as client:
                response = client.get(
                    WEBZ_URL,
                    params={
                        "token": self._token,
                        "q": query,
                        "size": min(max(limit, 1), 20),
                        "sort": "crawled",
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as error:  # noqa: BLE001 - provider boundary, never echo the token
            raise NewsProviderError("news provider request failed") from error

        posts = payload.get("posts") if isinstance(payload, dict) else None
        items: list[RawNewsItem] = []
        for post in posts or []:
            thread = post.get("thread") or {}
            source = post.get("source") or {}
            items.append(
                RawNewsItem(
                    title=str(post.get("title") or ""),
                    url=str(post.get("url") or ""),
                    publisher=str(thread.get("site") or source.get("domain") or ""),
                    published_at=post.get("published") or post.get("crawled"),
                    summary=str(post.get("text") or post.get("highlightText") or ""),
                )
            )
        return items


@dataclass(frozen=True)
class _CacheEntry:
    items: tuple[NewsItem, ...]
    fetched_at: datetime


class NewsService:
    def __init__(
        self,
        provider: NewsProvider,
        *,
        catalog: tuple[Mapping[str, NewsTopic], str] | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> None:
        self._provider = provider
        self._topics, self._catalogue_version = catalog or load_catalog()
        self._clock = clock
        self._ttl = max(0, ttl_seconds)
        self._cache: dict[tuple[str, str], _CacheEntry] = {}
        self._lock = threading.Lock()

    @property
    def provider_name(self) -> str:
        return self._provider.name

    @property
    def catalogue_version(self) -> str:
        return self._catalogue_version

    def topics(self) -> list[NewsTopic]:
        return list(self._topics.values())

    def get_feed(self, region: str, topic_key: str, limit: int) -> FeedResult:
        if region not in REGIONS:
            raise NewsQueryError("Unknown news region")
        topic = self._topics.get(topic_key.strip().casefold())
        if topic is None:
            raise NewsQueryError("Unknown news topic")
        limit = max(1, min(limit, MAX_ITEMS))
        now = self._clock()

        if not self._provider.configured:
            return FeedResult(region, topic.key, now, "NOT_CONFIGURED", self._provider.name, ())

        cache_key = (region, topic.key)
        with self._lock:
            cached = self._cache.get(cache_key)
        if cached is not None and (now - cached.fetched_at).total_seconds() < self._ttl:
            return FeedResult(region, topic.key, cached.fetched_at, "FRESH", self._provider.name, cached.items[:limit])

        try:
            raw_items: list[RawNewsItem] = []
            failures = 0
            queries = topic.queries[region]
            for query in queries:
                try:
                    raw_items.extend(self._provider.fetch(query, region, limit))
                except NewsProviderError:
                    failures += 1
            if failures and failures == len(queries):
                raise NewsProviderError("every news query failed")

            normalised = [
                item
                for raw in raw_items
                if (item := _normalise(raw, region=region, topic=topic.key, provider=self._provider.name, retrieved_at=now))
                is not None
            ]
            items = tuple(dedupe_and_rank(normalised, now=now, limit=limit))
            with self._lock:
                self._cache[cache_key] = _CacheEntry(items, now)
            return FeedResult(
                region, topic.key, now, "FRESH" if items else "NOT_COVERED", self._provider.name, items
            )
        except NewsConfigurationError:
            return FeedResult(region, topic.key, now, "NOT_CONFIGURED", self._provider.name, ())
        except Exception:  # noqa: BLE001 - degrade visibly, never 500 the dashboard
            LOGGER.warning("News feed refresh failed for %s/%s", region, topic.key)
            with self._lock:
                cached = self._cache.get(cache_key)
            if cached is not None:
                return FeedResult(
                    region, topic.key, cached.fetched_at, "STALE", self._provider.name, cached.items[:limit]
                )
            return FeedResult(region, topic.key, now, "UNAVAILABLE", self._provider.name, ())


def build_news_service() -> NewsService:
    name = os.getenv("ECOSITE_NEWS_PROVIDER", "rss").strip().casefold()
    if name == "rss":
        provider: NewsProvider = GoogleNewsRssProvider()
    elif name in {"webz", "webz.io"}:
        provider = WebzNewsProvider()
    elif name == "disabled":
        provider = DisabledNewsProvider()
    else:
        raise RuntimeError("ECOSITE_NEWS_PROVIDER must be 'rss', 'webz' or 'disabled'.")
    try:
        ttl = int(os.getenv("ECOSITE_NEWS_CACHE_TTL_SECONDS", str(DEFAULT_TTL_SECONDS)))
    except ValueError as error:
        raise RuntimeError("ECOSITE_NEWS_CACHE_TTL_SECONDS must be an integer.") from error
    return NewsService(provider, ttl_seconds=ttl)
