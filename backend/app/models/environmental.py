"""Public environmental station, observation and rollup persistence."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .projects import Base, utc_timestamp


AVAILABILITY_STATUSES = (
    "AVAILABLE", "PARTIAL", "STALE", "SOURCE_UNAVAILABLE", "NOT_APPLICABLE", "UNKNOWN",
)
QUALITY_STATUSES = ("preliminary", "provisional", "validated", "unknown")
TEMPORAL_CLASSES = ("NEAR_REAL_TIME", "PERIODIC", "DERIVED")


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class MetricDefinition(Base):
    __tablename__ = "metric_definitions"
    __table_args__ = (
        CheckConstraint("value_kind IN ('numeric', 'category', 'index')", name="ck_metric_definitions_kind"),
        CheckConstraint("default_range IN ('24h', '7d', '30d', '90d', '1y')", name="ck_metric_definitions_range"),
        CheckConstraint("preferred_aggregation IN ('mean', 'min_max_mean', 'sum', 'latest', 'latest_max', 'vector_latest')", name="ck_metric_definitions_aggregation"),
        CheckConstraint("stale_after_seconds > 0", name="ck_metric_definitions_stale"),
        CheckConstraint("valid_min IS NULL OR valid_max IS NULL OR valid_max >= valid_min", name="ck_metric_definitions_bounds"),
    )

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100))
    family: Mapped[str] = mapped_column(String(40), index=True)
    canonical_unit: Mapped[str] = mapped_column(String(32))
    value_kind: Mapped[str] = mapped_column(String(16))
    preferred_aggregation: Mapped[str] = mapped_column(String(24))
    default_range: Mapped[str] = mapped_column(String(8))
    stale_after_seconds: Mapped[int] = mapped_column(Integer)
    valid_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    valid_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class MonitoringStation(Base):
    __tablename__ = "monitoring_stations"
    __table_args__ = (
        UniqueConstraint("source_id", "native_station_id", name="uq_monitoring_stations_provider_key"),
        CheckConstraint("public_longitude BETWEEN -180 AND 180", name="ck_monitoring_stations_longitude"),
        CheckConstraint("public_latitude BETWEEN -90 AND 90", name="ck_monitoring_stations_latitude"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'UNKNOWN')", name="ck_monitoring_stations_status"),
        CheckConstraint("visibility = 'PUBLIC'", name="ck_monitoring_stations_visibility"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)
    native_station_id: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(300))
    provider: Mapped[str] = mapped_column(String(200))
    state_code: Mapped[str | None] = mapped_column(String(5), nullable=True, index=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    locality: Mapped[str | None] = mapped_column(String(200), nullable=True)
    public_longitude: Mapped[float] = mapped_column(Float)
    public_latitude: Mapped[float] = mapped_column(Float)
    station_type: Mapped[str] = mapped_column(String(100))
    measured_metrics: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE")
    first_seen_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_seen_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    visibility: Mapped[str] = mapped_column(String(24), default="PUBLIC")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilityStationLink(Base):
    __tablename__ = "facility_station_links"
    __table_args__ = (
        UniqueConstraint("facility_id", "station_id", "metric_key", "effective_at", name="uq_facility_station_links_effective"),
        CheckConstraint("distance_km >= 0", name="ck_facility_station_links_distance"),
        CheckConstraint(
            "selection_method IN ('nearest_eligible', 'same_district', 'manual_authority_mapping')",
            name="ck_facility_station_links_method",
        ),
        CheckConstraint("expires_at IS NULL OR expires_at > effective_at", name="ck_facility_station_links_window"),
        Index("ix_facility_station_links_facility_metric", "facility_id", "metric_key", "effective_at"),
        Index("ix_facility_station_links_station_metric", "station_id", "metric_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="CASCADE"), index=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("monitoring_stations.id", ondelete="RESTRICT"), index=True)
    metric_key: Mapped[str] = mapped_column(ForeignKey("metric_definitions.key", ondelete="RESTRICT"), index=True)
    distance_km: Mapped[float] = mapped_column(Float)
    selection_method: Mapped[str] = mapped_column(String(40))
    effective_at: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    processing_version: Mapped[str] = mapped_column(String(32))
    selection_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class EnvironmentalObservation(Base):
    __tablename__ = "environmental_observations"
    __table_args__ = (
        UniqueConstraint("source_id", "provider_dedupe_key", name="uq_environmental_observations_provider_dedupe"),
        CheckConstraint(f"status IN ({_quoted(AVAILABILITY_STATUSES)})", name="ck_environmental_observations_status"),
        CheckConstraint(f"quality IN ({_quoted(QUALITY_STATUSES)})", name="ck_environmental_observations_quality"),
        CheckConstraint(f"temporal_class IN ({_quoted(TEMPORAL_CLASSES)})", name="ck_environmental_observations_temporal"),
        CheckConstraint("visibility IN ('PUBLIC', 'MINISTRY', 'REGULATOR_RESTRICTED')", name="ck_environmental_observations_visibility"),
        CheckConstraint("evidence_class IN ('MEASURED', 'AUTHORITY_VERIFIED', 'DOCUMENTED', 'MODELLED', 'UNAVAILABLE')", name="ck_environmental_observations_evidence"),
        CheckConstraint(
            "(value IS NOT NULL AND category_value IS NULL AND missing_reason IS NULL) OR "
            "(value IS NULL AND category_value IS NOT NULL AND missing_reason IS NULL) OR "
            "(value IS NULL AND category_value IS NULL AND missing_reason IS NOT NULL)",
            name="ck_environmental_observations_value",
        ),
        Index("ix_environmental_observations_station_metric_time", "station_id", "metric_key", "observed_at"),
        Index("ix_environmental_observations_facility_metric_time", "facility_id", "metric_key", "observed_at"),
        Index("ix_environmental_observations_source_retrieved", "source_id", "retrieved_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("monitoring_stations.id", ondelete="RESTRICT"), index=True)
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("public_facilities.id", ondelete="SET NULL"), nullable=True, index=True)
    metric_key: Mapped[str] = mapped_column(ForeignKey("metric_definitions.key", ondelete="RESTRICT"), index=True)
    ingestion_run_id: Mapped[str | None] = mapped_column(ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    raw_snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("raw_snapshots.id", ondelete="SET NULL"), nullable=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    category_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    canonical_unit: Mapped[str] = mapped_column(String(32))
    original_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_category_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    original_unit: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(30))
    quality: Mapped[str] = mapped_column(String(20))
    evidence_class: Mapped[str] = mapped_column(String(30))
    temporal_class: Mapped[str] = mapped_column(String(24))
    visibility: Mapped[str] = mapped_column(String(24))
    observed_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    published_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    retrieved_at: Mapped[str] = mapped_column(String(32))
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    missing_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider_dedupe_key: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class EnvironmentalRollup(Base):
    __tablename__ = "environmental_rollups"
    __table_args__ = (
        UniqueConstraint("station_id", "metric_key", "interval", "bucket_start", name="uq_environmental_rollups_bucket"),
        CheckConstraint("interval IN ('hour', 'day')", name="ck_environmental_rollups_interval"),
        CheckConstraint("bucket_end > bucket_start", name="ck_environmental_rollups_window"),
        CheckConstraint(f"status IN ({_quoted(AVAILABILITY_STATUSES)})", name="ck_environmental_rollups_status"),
        CheckConstraint(f"quality IN ({_quoted(QUALITY_STATUSES)})", name="ck_environmental_rollups_quality"),
        CheckConstraint("sample_count >= 0 AND valid_sample_count >= 0 AND expected_sample_count >= 0", name="ck_environmental_rollups_counts"),
        CheckConstraint("valid_sample_count <= sample_count", name="ck_environmental_rollups_valid_count"),
        CheckConstraint("coverage_fraction BETWEEN 0 AND 1", name="ck_environmental_rollups_coverage"),
        Index("ix_environmental_rollups_metric_bucket_interval", "metric_key", "bucket_start", "interval"),
        Index("ix_environmental_rollups_station_metric_bucket", "station_id", "metric_key", "bucket_start"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("monitoring_stations.id", ondelete="CASCADE"), index=True)
    metric_key: Mapped[str] = mapped_column(ForeignKey("metric_definitions.key", ondelete="RESTRICT"), index=True)
    interval: Mapped[str] = mapped_column(String(8))
    bucket_start: Mapped[str] = mapped_column(String(32))
    bucket_end: Mapped[str] = mapped_column(String(32))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    minimum: Mapped[float | None] = mapped_column(Float, nullable=True)
    maximum: Mapped[float | None] = mapped_column(Float, nullable=True)
    total: Mapped[float | None] = mapped_column(Float, nullable=True)
    latest: Mapped[float | None] = mapped_column(Float, nullable=True)
    category_latest: Mapped[str | None] = mapped_column(String(100), nullable=True)
    canonical_unit: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(30))
    quality: Mapped[str] = mapped_column(String(20))
    sample_count: Mapped[int] = mapped_column(Integer)
    valid_sample_count: Mapped[int] = mapped_column(Integer)
    expected_sample_count: Mapped[int] = mapped_column(Integer)
    coverage_fraction: Mapped[float] = mapped_column(Float)
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    processing_version: Mapped[str] = mapped_column(String(32))
    generated_at: Mapped[str] = mapped_column(String(32))

