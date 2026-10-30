import unittest
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.news import router
from backend.app.services.news import NewsProviderError, NewsService, RawNewsItem, load_catalog

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


class FakeProvider:
    name = "fake"
    configured = True

    def __init__(self, items=None, error=None):
        self.items = list(items or [])
        self.error = error

    def fetch(self, query, region, limit):
        if self.error is not None:
            raise self.error
        return list(self.items)


def build_client(provider):
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.state.news_service = NewsService(
        provider,
        catalog=load_catalog(),
        clock=lambda: NOW,
    )
    return TestClient(app)


def item(title="Data centre policy approved", url="https://example.test/story"):
    return RawNewsItem(
        title=title,
        url=url,
        publisher="Example Wire",
        published_at=NOW.isoformat(),
        summary="A short summary.",
    )


class NewsApiTests(unittest.TestCase):
    def test_topics_lists_regions_and_catalogue(self):
        response = build_client(FakeProvider()).get("/api/v1/news/topics")
        self.assertEqual(200, response.status_code)
        body = response.json()
        self.assertEqual(["india", "world"], body["regions"])
        self.assertIn("all", {topic["key"] for topic in body["topics"]})
        self.assertTrue(body["catalogueVersion"])

    def test_feed_returns_media_items_with_provenance_and_cache_header(self):
        response = build_client(FakeProvider([item()])).get(
            "/api/v1/news/feed", params={"region": "india", "topic": "dc_policy", "limit": 8}
        )
        self.assertEqual(200, response.status_code)
        self.assertIn("max-age=300", response.headers["cache-control"])
        body = response.json()
        self.assertEqual("india", body["region"])
        self.assertEqual("dc_policy", body["topic"])
        self.assertEqual("FRESH", body["coverage"])
        self.assertEqual("fake", body["provider"])
        self.assertEqual("MEDIA_REPORT", body["items"][0]["mediaClass"])
        self.assertEqual(["dc_policy"], body["items"][0]["topics"])
        self.assertNotIn("token", response.text.casefold())

    def test_invalid_region_is_a_validation_envelope(self):
        response = build_client(FakeProvider()).get(
            "/api/v1/news/feed", params={"region": "mars"}
        )
        self.assertEqual(422, response.status_code)
        error = response.json()["error"]
        self.assertEqual("validation_failed", error["code"])
        self.assertTrue(error["requestId"].startswith("req_"))

    def test_unknown_topic_is_rejected_without_calling_the_provider(self):
        provider = FakeProvider([item()])
        response = build_client(provider).get(
            "/api/v1/news/feed", params={"region": "india", "topic": "not-a-topic"}
        )
        self.assertEqual(422, response.status_code)
        self.assertEqual("invalid_request", response.json()["error"]["code"])

    def test_limit_bounds_are_enforced(self):
        client = build_client(FakeProvider([item()]))
        self.assertEqual(422, client.get("/api/v1/news/feed", params={"region": "india", "limit": 0}).status_code)
        self.assertEqual(422, client.get("/api/v1/news/feed", params={"region": "india", "limit": 99}).status_code)

    def test_upstream_failure_is_reported_as_coverage_not_a_500(self):
        response = build_client(FakeProvider(error=NewsProviderError("boom"))).get(
            "/api/v1/news/feed", params={"region": "world", "topic": "all"}
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual("UNAVAILABLE", response.json()["coverage"])
        self.assertEqual([], response.json()["items"])
        self.assertNotIn("boom", response.text)

    def test_missing_service_is_a_503_envelope(self):
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        response = TestClient(app).get("/api/v1/news/feed", params={"region": "india"})
        self.assertEqual(503, response.status_code)
        self.assertEqual("service_unavailable", response.json()["error"]["code"])


if __name__ == "__main__":
    unittest.main()
