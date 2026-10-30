"""Public media-context contract for the data-centre news feed.

Items are media reports, never verified evidence. The contract deliberately
carries publisher provenance and never exposes provider credentials.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

NewsRegion = Literal["india", "world"]
NewsCoverage = Literal["FRESH", "STALE", "NOT_COVERED", "NOT_CONFIGURED", "UNAVAILABLE"]


class NewsItem(BaseModel):
    id: str = Field(min_length=8, max_length=64)
    title: str = Field(min_length=1, max_length=400)
    url: str = Field(pattern=r"^https?://")
    publisher: str = Field(min_length=1, max_length=200)
    publishedAt: str
    summary: str | None = None
    region: NewsRegion
    topics: list[str]
    provider: str
    mediaClass: Literal["MEDIA_REPORT"] = "MEDIA_REPORT"
    retrievedAt: str


class NewsFeedResponse(BaseModel):
    region: NewsRegion
    topic: str
    generatedAt: str
    coverage: NewsCoverage
    provider: str
    items: list[NewsItem]


class NewsTopicRead(BaseModel):
    key: str
    label: str


class NewsTopicsResponse(BaseModel):
    regions: list[NewsRegion]
    topics: list[NewsTopicRead]
    catalogueVersion: str
