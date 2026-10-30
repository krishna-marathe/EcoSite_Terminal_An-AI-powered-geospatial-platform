import unittest
from datetime import datetime, timedelta, timezone

from backend.app.services.news import (
    GoogleNewsRssProvider,
    NewsProviderError,
    NewsService,
    RawNewsItem,
    canonical_url,
    load_catalog,
)

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
CATALOG = load_catalog()


def raw(title, url="https://example.test/story", publisher="Example Wire", published=NOW, summary=""):
    return RawNewsItem(
        title=title,
        url=url,
        publisher=publisher,
        published_at=published.isoformat() if isinstance(published, datetime) else published,
        summary=summary,
    )


class FakeProvider:
    name = "fake"
    configured = True

    def __init__(self, items=None, error=None):
        self.items = list(items or [])
        self.error = error
        self.calls = []

    def fetch(self, query, region, limit):
        self.calls.append((query, region, limit))
        if self.error is not None:
            raise self.error
        return list(self.items)


class MutableClock:
    def __init__(self, value=NOW):
        self.value = value

    def __call__(self):
        return self.value

    def advance(self, seconds):
        self.value = self.value + timedelta(seconds=seconds)


class NewsServiceTests(unittest.TestCase):
    def test_dedupes_urls_titles_and_near_duplicates(self):
        provider = FakeProvider(
            [
                raw("Maharashtra data centre policy approved", url="https://a.test/x?utm=1"),
                raw("Maharashtra data centre policy approved", url="https://a.test/x"),
                raw("Maharashtra data centre policy approved today", url="https://b.test/y"),
                raw("Karnataka data centre policy approved", url="https://c.test/z"),
            ]
        )
        service = NewsService(provider, catalog=CATALOG, clock=MutableClock())
        result = service.get_feed("india", "all", 8)
        self.assertEqual("FRESH", result.coverage)
        self.assertEqual(2, len(result.items))
        self.assertTrue({item.title for item in result.items} >= {
            "Maharashtra data centre policy approved",
            "Karnataka data centre policy approved",
        })

    def test_drops_old_malformed_and_future_items(self):
        provider = FakeProvider(
            [
                raw("Recent data centre story", url="https://a.test/recent"),
                raw("Old data centre story", url="https://a.test/old", published=NOW - timedelta(days=40)),
                raw("Ftp data centre story", url="ftp://a.test/file"),
                raw("Undated data centre story", url="https://a.test/undated", published=None),
                raw("Future data centre story", url="https://a.test/future", published=NOW + timedelta(days=5)),
            ]
        )
        service = NewsService(provider, catalog=CATALOG, clock=MutableClock())
        result = service.get_feed("world", "all", 8)
        urls = {item.url for item in result.items}
        self.assertEqual({"https://a.test/recent", "https://a.test/future"}, urls)
        future = next(item for item in result.items if item.url.endswith("future"))
        self.assertEqual(NOW.isoformat().replace("+00:00", "Z"), future.publishedAt)

    def test_publisher_suffix_is_removed_from_titles(self):
        provider = FakeProvider([raw("Data centre policy approved - Example Wire")])
        item = NewsService(provider, catalog=CATALOG, clock=MutableClock()).get_feed("india", "all", 8).items[0]
        self.assertEqual("Data centre policy approved", item.title)

    def test_summary_is_truncated_and_marked_as_media_report(self):
        provider = FakeProvider([raw("Data centre story", summary="<p>" + "word " * 200 + "</p>")])
        service = NewsService(provider, catalog=CATALOG, clock=MutableClock())
        item = service.get_feed("india", "all", 8).items[0]
        self.assertLessEqual(len(item.summary or ""), 280)
        self.assertEqual("MEDIA_REPORT", item.mediaClass)
        self.assertEqual("fake", item.provider)
        self.assertNotIn("<p>", item.summary or "")

    def test_india_and_world_queries_are_region_specific(self):
        india = FakeProvider([raw("India data centre story", url="https://a.test/india")])
        world = FakeProvider([raw("World data centre story", url="https://a.test/world")])
        NewsService(india, catalog=CATALOG, clock=MutableClock()).get_feed("india", "dc_policy", 8)
        NewsService(world, catalog=CATALOG, clock=MutableClock()).get_feed("world", "dc_policy", 8)
        india_queries = {call[0] for call in india.calls}
        world_queries = {call[0] for call in world.calls}
        self.assertTrue(india_queries <= set(CATALOG[0]["dc_policy"].queries["india"]))
        self.assertTrue(world_queries <= set(CATALOG[0]["dc_policy"].queries["world"]))
        self.assertNotEqual(india_queries, world_queries)
        self.assertTrue(all(call[1] == "india" for call in india.calls))
        self.assertTrue(all(call[1] == "world" for call in world.calls))

    def test_cache_prevents_provider_calls_until_ttl_expires(self):
        clock = MutableClock()
        provider = FakeProvider([raw("Cached data centre story")])
        service = NewsService(provider, catalog=CATALOG, clock=clock, ttl_seconds=900)
        first = service.get_feed("india", "all", 8)
        calls = len(provider.calls)
        second = service.get_feed("india", "all", 8)
        self.assertEqual(calls, len(provider.calls))
        self.assertEqual(first.items, second.items)
        clock.advance(901)
        service.get_feed("india", "all", 8)
        self.assertGreater(len(provider.calls), calls)

    def test_stale_items_are_served_when_refresh_fails(self):
        clock = MutableClock()
        provider = FakeProvider([raw("Cached data centre story")])
        service = NewsService(provider, catalog=CATALOG, clock=clock, ttl_seconds=60)
        first = service.get_feed("india", "all", 8)
        clock.advance(120)
        provider.error = NewsProviderError("upstream failed")
        result = service.get_feed("india", "all", 8)
        self.assertEqual("STALE", result.coverage)
        self.assertEqual(first.items, result.items)
        self.assertEqual(first.generated_at, result.generated_at)

    def test_unavailable_is_reported_instead_of_an_empty_fresh_feed(self):
        provider = FakeProvider(error=NewsProviderError("upstream failed"))
        service = NewsService(provider, catalog=CATALOG, clock=MutableClock())
        result = service.get_feed("world", "all", 8)
        self.assertEqual("UNAVAILABLE", result.coverage)
        self.assertEqual((), result.items)

    def test_disabled_provider_reports_not_configured(self):
        provider = FakeProvider([raw("Data centre story")])
        provider.configured = False
        service = NewsService(provider, catalog=CATALOG, clock=MutableClock())
        result = service.get_feed("india", "all", 8)
        self.assertEqual("NOT_CONFIGURED", result.coverage)
        self.assertEqual([], provider.calls)

    def test_unknown_topic_and_region_are_rejected(self):
        service = NewsService(FakeProvider(), catalog=CATALOG, clock=MutableClock())
        with self.assertRaises(ValueError):
            service.get_feed("india", "not-a-topic", 8)
        with self.assertRaises(ValueError):
            service.get_feed("mars", "all", 8)

    def test_government_sources_rank_above_general_outlets(self):
        provider = FakeProvider(
            [
                raw("Data centre policy roundup", url="https://news.test/1", publisher="Example Daily", published=NOW),
                raw("Data centre policy notified", url="https://gov.test/2", publisher="Ministry of Electronics", published=NOW - timedelta(days=2)),
            ]
        )
        service = NewsService(provider, catalog=CATALOG, clock=MutableClock())
        result = service.get_feed("india", "all", 8)
        self.assertEqual("Ministry of Electronics", result.items[0].publisher)

    def test_catalogue_exposes_all_topic_and_both_regions(self):
        topics, version = CATALOG
        self.assertIn("all", topics)
        self.assertTrue(version)
        for topic in topics.values():
            self.assertTrue(topic.queries["india"])
            self.assertTrue(topic.queries["world"])

    def test_canonical_url_strips_tracking_and_scheme_differences(self):
        self.assertEqual("example.test/story", canonical_url("https://www.Example.test/story/?utm_source=x#top"))
        self.assertIsNone(canonical_url("javascript:alert(1)"))


class RssProviderTests(unittest.TestCase):
    def test_parses_feed_and_uses_india_locale(self):
        body = b"""<?xml version="1.0"?><rss><channel>
        <item>
          <title>Data centre policy approved - Example Wire</title>
          <link>https://news.google.com/rss/articles/abc?oc=5</link>
          <pubDate>Thu, 29 Oct 2026 09:00:00 GMT</pubDate>
          <description>&lt;a href="x"&gt;Policy summary&lt;/a&gt;</description>
          <source>Example Wire</source>
        </item>
        </channel></rss>"""
        captured = {}

        class Response:
            def read(self):
                return body

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        def opener(request, timeout=None):
            captured["url"] = request.full_url
            captured["timeout"] = timeout
            return Response()

        provider = GoogleNewsRssProvider(opener=opener)
        items = provider.fetch("data centre India", "india", 8)
        self.assertIn("hl=en-IN", captured["url"])
        self.assertEqual(8.0, captured["timeout"])
        self.assertEqual(1, len(items))
        self.assertEqual("Data centre policy approved - Example Wire", items[0].title)
        self.assertEqual("Example Wire", items[0].publisher)
        self.assertIn("Policy summary", items[0].summary)

    def test_provider_failure_uses_a_safe_error(self):
        def opener(request, timeout=None):
            raise OSError("network down")

        provider = GoogleNewsRssProvider(opener=opener)
        with self.assertRaises(NewsProviderError) as caught:
            provider.fetch("data centre India", "india", 8)
        self.assertNotIn("network down", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
