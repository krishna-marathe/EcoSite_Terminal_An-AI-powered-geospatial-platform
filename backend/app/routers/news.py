"""Read-only media-context endpoints for the dashboard news feed.

Queries are fixed server-side by topic and region; the browser cannot pass free
text to the provider, so the endpoint cannot be used as an open proxy.
"""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from ..schemas.news import (
    NewsFeedResponse,
    NewsItem,
    NewsRegion,
    NewsTopicRead,
    NewsTopicsResponse,
)
from ..schemas.public_facilities import ApiError
from ..services.news import REGIONS, NewsQueryError, NewsService


class NewsUnavailable(RuntimeError):
    pass


def _request_id(request: Request) -> str:
    supplied = request.headers.get("x-request-id", "").strip()
    return supplied[:100] if supplied else f"req_{uuid4().hex}"


def _error(request: Request, status: int, code: str, message: str) -> JSONResponse:
    payload = ApiError.model_validate(
        {
            "error": {
                "code": code,
                "message": message,
                "details": {},
                "requestId": _request_id(request),
            }
        }
    )
    return JSONResponse(status_code=status, content=payload.model_dump(mode="json"))


class NewsContractRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def contract_handler(request: Request):
            try:
                return await handler(request)
            except RequestValidationError:
                return _error(
                    request,
                    422,
                    "validation_failed",
                    "Request validation failed.",
                )
            except NewsQueryError:
                return _error(request, 422, "invalid_request", "Unknown news region or topic.")
            except NewsUnavailable:
                return _error(
                    request,
                    503,
                    "service_unavailable",
                    "The news feed service is not configured.",
                )

        return contract_handler


router = APIRouter(tags=["Data-centre media context"], route_class=NewsContractRoute)


def get_news_service(request: Request) -> NewsService:
    service = getattr(request.app.state, "news_service", None)
    if service is None:
        raise NewsUnavailable()
    return service


@router.get("/news/topics", response_model=NewsTopicsResponse)
def news_topics(request: Request) -> NewsTopicsResponse:
    service = get_news_service(request)
    return NewsTopicsResponse(
        regions=list(REGIONS),  # type: ignore[arg-type]
        topics=[NewsTopicRead(key=topic.key, label=topic.label) for topic in service.topics()],
        catalogueVersion=service.catalogue_version,
    )


@router.get("/news/feed", response_model=NewsFeedResponse)
def news_feed(
    request: Request,
    response: Response,
    region: NewsRegion,
    topic: str = Query(default="all", min_length=1, max_length=40),
    limit: int = Query(default=8, ge=1, le=12),
) -> NewsFeedResponse:
    result = get_news_service(request).get_feed(region, topic, limit)
    # The service already caches provider responses; this bounds browser/proxy
    # reuse without hiding a stale refresh longer than the provider TTL.
    response.headers["Cache-Control"] = "public, max-age=300"
    return NewsFeedResponse(
        region=result.region,  # type: ignore[arg-type]
        topic=result.topic,
        generatedAt=result.generated_at.isoformat().replace("+00:00", "Z"),
        coverage=result.coverage,  # type: ignore[arg-type]
        provider=result.provider,
        items=[NewsItem.model_validate(item, from_attributes=True) for item in result.items],
    )
