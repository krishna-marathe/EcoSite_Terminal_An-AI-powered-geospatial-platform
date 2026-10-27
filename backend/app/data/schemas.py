"""API contracts for the source registry and the data-plane records."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["P0", "P1", "P2"]
TestStatus = Literal["DISCOVERED", "ACCESS_TESTED", "PROCESSING_TESTED", "VALIDATED", "INTEGRATED"]
RuntimeStatus = Literal["NOT_CONNECTED", "CONNECTED", "STALE", "SOURCE_UNAVAILABLE"]
AccessMethod = Literal["download", "api", "stac", "wms", "report", "manual"]
DataCategory = Literal["GIS", "OFFICIAL_ADMIN", "POLICY", "AUTHORITY", "DEVELOPER"]
EvidenceClass = Literal[
    "MEASURED",
    "AUTHORITY_VERIFIED",
    "DECLARED",
    "DOCUMENTED",
    "OFFICIAL_GEOSPATIAL",
    "REMOTE_SENSING_DERIVED",
    "MODELLED",
    "CROWD_SOURCED",
    "SYNTHETIC_DEMO",
    "UNAVAILABLE",
]
ObservationStatus = Literal[
    "AVAILABLE",
    "PARTIAL",
    "STALE",
    "SOURCE_UNAVAILABLE",
    "NOT_APPLICABLE",
    "UNKNOWN",
]


class DataSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    dataset_name: str
    dataset_version: str
    data_category: DataCategory
    priority: Priority
    access_method: AccessMethod
    authentication: str
    base_url: str | None
    exact_endpoint: str | None
    licence: str
    licence_url: str | None
    attribution: str
    can_cache: bool
    can_redistribute: bool
    commercial_use: bool
    resolution: str
    temporal_resolution: str
    coverage: str
    observation_period: str
    latest_release: str
    update_frequency: str
    join_key_or_geometry: str
    test_status: TestStatus
    fallback: str
    owner: str
    next_action: str
    runtime_status: RuntimeStatus
    last_checked_at: str | None
    last_success_at: str | None
    quality_notes: str


class ScopeRead(BaseModel):
    states: dict[str, str]
    boundary_version: str
    boundary_sha256: str
    screening_only: bool
    note: str


class DataSourceList(BaseModel):
    items: list[DataSourceRead]
    total: int
    by_priority: dict[str, int]
    by_test_status: dict[str, int]
    scope: ScopeRead


class IngestionRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_id: str
    started_at: str
    finished_at: str | None
    status: Literal["success", "partial", "failed"]
    http_status: int | None
    bytes: int | None
    sha256: str | None
    parser_version: str
    error: str | None


class DataSourceDetail(DataSourceRead):
    recent_runs: list[IngestionRunRead] = Field(default_factory=list)


class ObservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_id: str
    site_id: str | None
    geometry_hash: str | None
    indicator: str
    value: float | None
    unit: str
    status: ObservationStatus
    evidence_class: EvidenceClass
    dataset_version: str
    period_start: str | None
    period_end: str | None
    observed_at: str | None
    published_at: str | None
    retrieved_at: str
    resolution: str
    method: str
    processing_version: str
    coverage_fraction: float | None
    quality_flags: dict
    missing_reason: str | None
    raw_snapshot_id: str | None


class ObservationList(BaseModel):
    items: list[ObservationRead]
    total: int


class EnvironmentalAnalysisRequest(BaseModel):
    sources: list[str] = Field(default_factory=lambda: ["jrc_gsw", "nasa_srtmgl1"])
    buffer_m: float = Field(default=1000.0, ge=0, le=50000)
    max_tiles: int = Field(default=4, ge=1, le=16)
    max_pages: int = Field(default=3, ge=1, le=10)


class IngestionResultRead(BaseModel):
    source_id: str
    run_id: str
    status: Literal["success", "partial", "failed"]
    error: str | None
    observation_count: int


class EnvironmentalAnalysisResponse(BaseModel):
    site_id: str
    geometry_hash: str
    results: list[IngestionResultRead]
    observations: list[ObservationRead]
