"""SQLAlchemy models for the source registry, ingestion runs and observations.

The data plane follows the roadmap's observation contract: every record carries a
dataset version, a period, a geometry hash, a method, a unit, a spatial resolution,
coverage and a missing-data reason. These tables sit beside the existing
project/site/phase tables and do not replace the legacy facilities table.
"""
from __future__ import annotations

from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..models.projects import Base, utc_timestamp

ACCESS_METHODS = ("download", "api", "stac", "wms", "report", "manual")
DATA_CATEGORIES = ("GIS", "OFFICIAL_ADMIN", "POLICY", "AUTHORITY", "DEVELOPER")
PRIORITIES = ("P0", "P1", "P2")
TEST_STATUSES = ("DISCOVERED", "ACCESS_TESTED", "PROCESSING_TESTED", "VALIDATED", "INTEGRATED")
RUNTIME_STATUSES = ("NOT_CONNECTED", "CONNECTED", "STALE", "SOURCE_UNAVAILABLE")
EVIDENCE_CLASSES = (
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
)
OBSERVATION_STATUSES = (
    "AVAILABLE",
    "PARTIAL",
    "STALE",
    "SOURCE_UNAVAILABLE",
    "NOT_APPLICABLE",
    "UNKNOWN",
)
RUN_STATUSES = ("success", "partial", "failed")
EVIDENCE_STATUSES = (
    "declared",
    "documented",
    "verified",
    "expired",
    "superseded",
    "conflicting",
    "missing",
)
METRIC_STATUSES = ("AVAILABLE", "PARTIAL", "STALE", "SOURCE_UNAVAILABLE", "UNKNOWN")


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class DataSource(Base):
    __tablename__ = "data_sources"
    __table_args__ = (
        CheckConstraint(f"access_method IN ({_quoted(ACCESS_METHODS)})", name="ck_data_sources_access"),
        CheckConstraint(f"data_category IN ({_quoted(DATA_CATEGORIES)})", name="ck_data_sources_category"),
        CheckConstraint(f"priority IN ({_quoted(PRIORITIES)})", name="ck_data_sources_priority"),
        CheckConstraint(f"test_status IN ({_quoted(TEST_STATUSES)})", name="ck_data_sources_test_status"),
        CheckConstraint(f"runtime_status IN ({_quoted(RUNTIME_STATUSES)})", name="ck_data_sources_runtime_status"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(200))
    dataset_name: Mapped[str] = mapped_column(String(300))
    dataset_version: Mapped[str] = mapped_column(String(64))
    data_category: Mapped[str] = mapped_column(String(30))
    priority: Mapped[str] = mapped_column(String(4))
    access_method: Mapped[str] = mapped_column(String(20))
    authentication: Mapped[str] = mapped_column(String(300))
    base_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    exact_endpoint: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    licence: Mapped[str] = mapped_column(String(300))
    licence_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    attribution: Mapped[str] = mapped_column(String(300))
    can_cache: Mapped[bool] = mapped_column(Boolean, default=True)
    can_redistribute: Mapped[bool] = mapped_column(Boolean, default=False)
    commercial_use: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution: Mapped[str] = mapped_column(String(300))
    temporal_resolution: Mapped[str] = mapped_column(String(300))
    coverage: Mapped[str] = mapped_column(String(500))
    observation_period: Mapped[str] = mapped_column(String(200))
    latest_release: Mapped[str] = mapped_column(String(100))
    update_frequency: Mapped[str] = mapped_column(String(100))
    join_key_or_geometry: Mapped[str] = mapped_column(String(300))
    test_status: Mapped[str] = mapped_column(String(20), default="DISCOVERED")
    fallback: Mapped[str] = mapped_column(String(500), default="")
    owner: Mapped[str] = mapped_column(String(100), default="")
    next_action: Mapped[str] = mapped_column(String(500), default="")
    runtime_status: Mapped[str] = mapped_column(String(30), default="NOT_CONNECTED")
    last_checked_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_success_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    quality_notes: Mapped[str] = mapped_column(String(2000), default="")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    __table_args__ = (
        CheckConstraint(f"status IN ({_quoted(RUN_STATUSES)})", name="ck_ingestion_runs_status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)
    started_at: Mapped[str] = mapped_column(String(32))
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parser_version: Mapped[str] = mapped_column(String(32))
    error: Mapped[str | None] = mapped_column(String(2000), nullable=True)


class RawSnapshot(Base):
    __tablename__ = "raw_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("ingestion_runs.id", ondelete="RESTRICT"), index=True)
    path: Mapped[str] = mapped_column(String(1000))
    sha256: Mapped[str] = mapped_column(String(64))
    content_type: Mapped[str] = mapped_column(String(100))
    fetched_at: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (
        CheckConstraint(f"status IN ({_quoted(OBSERVATION_STATUSES)})", name="ck_observations_status"),
        CheckConstraint(f"evidence_class IN ({_quoted(EVIDENCE_CLASSES)})", name="ck_observations_evidence"),
        CheckConstraint("coverage_fraction IS NULL OR (coverage_fraction >= 0 AND coverage_fraction <= 1)", name="ck_observations_coverage"),
        CheckConstraint("value IS NOT NULL OR missing_reason IS NOT NULL", name="ck_observations_missing_reason"),
        UniqueConstraint("dedupe_key", name="uq_observations_dedupe"),
        Index("ix_observations_source_site_indicator", "source_id", "site_id", "indicator"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("candidate_sites.id", ondelete="SET NULL"), nullable=True, index=True)
    geometry_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    indicator: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30))
    evidence_class: Mapped[str] = mapped_column(String(30))
    dataset_version: Mapped[str] = mapped_column(String(64))
    period_start: Mapped[str | None] = mapped_column(String(32), nullable=True)
    period_end: Mapped[str | None] = mapped_column(String(32), nullable=True)
    observed_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    published_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    retrieved_at: Mapped[str] = mapped_column(String(32))
    resolution: Mapped[str] = mapped_column(String(200))
    method: Mapped[str] = mapped_column(String(100))
    processing_version: Mapped[str] = mapped_column(String(32))
    coverage_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_flags: Mapped[dict] = mapped_column(JSON, default=dict)
    missing_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("raw_snapshots.id", ondelete="SET NULL"), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class AuthorityEvidence(Base):
    __tablename__ = "authority_evidence"
    __table_args__ = (
        CheckConstraint(f"evidence_status IN ({_quoted(EVIDENCE_STATUSES)})", name="ck_authority_evidence_status"),
        Index("ix_authority_evidence_site_field", "site_id", "field"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    site_id: Mapped[str] = mapped_column(ForeignKey("candidate_sites.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(500))
    numeric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(40))
    evidence_status: Mapped[str] = mapped_column(String(20))
    issuer: Mapped[str] = mapped_column(String(200))
    reference: Mapped[str] = mapped_column(String(300))
    issued_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    valid_until: Mapped[str | None] = mapped_column(String(32), nullable=True)
    file_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verified_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class DeveloperEvidence(Base):
    """Private phase-bound developer design evidence, not operational telemetry."""

    __tablename__ = "developer_evidence"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_developer_evidence_revision"),
        CheckConstraint("phase_revision >= 1", name="ck_developer_evidence_phase_revision"),
        CheckConstraint(f"evidence_status IN ({_quoted(EVIDENCE_STATUSES)})", name="ck_developer_evidence_status"),
        CheckConstraint("design_wue_l_per_kwh_it IS NULL OR design_wue_l_per_kwh_it >= 0", name="ck_developer_evidence_wue"),
        CheckConstraint("design_cue_kgco2_per_kwh IS NULL OR design_cue_kgco2_per_kwh >= 0", name="ck_developer_evidence_cue"),
        CheckConstraint(
            "internal_reuse_fraction IS NULL OR (internal_reuse_fraction >= 0 AND internal_reuse_fraction <= 1)",
            name="ck_developer_evidence_reuse",
        ),
        CheckConstraint("backup_generation_mw IS NULL OR backup_generation_mw >= 0", name="ck_developer_evidence_backup"),
        UniqueConstraint("phase_id", "revision", name="uq_developer_evidence_phase_revision"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    site_id: Mapped[str] = mapped_column(ForeignKey("candidate_sites.id", ondelete="CASCADE"), index=True)
    phase_id: Mapped[str] = mapped_column(ForeignKey("project_phases.id", ondelete="CASCADE"), index=True)
    phase_revision: Mapped[int] = mapped_column(Integer)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    evidence_status: Mapped[str] = mapped_column(String(20))
    document_reference: Mapped[str] = mapped_column(String(300))
    document_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    declared_by: Mapped[str] = mapped_column(String(200))
    declared_on: Mapped[str] = mapped_column(String(32))
    valid_until: Mapped[str | None] = mapped_column(String(32), nullable=True)
    measurement_boundary: Mapped[str] = mapped_column(String(500))
    design_wue_l_per_kwh_it: Mapped[float | None] = mapped_column(Float, nullable=True)
    design_cue_kgco2_per_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    internal_reuse_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    backup_generation_mw: Mapped[float | None] = mapped_column(Float, nullable=True)
    backup_fuel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    water_source_mix: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    asset_register: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class ScoreRun(Base):
    __tablename__ = "score_runs"
    __table_args__ = (
        CheckConstraint("coverage IS NULL OR (coverage >= 0 AND coverage <= 1)", name="ck_score_runs_coverage"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    site_id: Mapped[str] = mapped_column(ForeignKey("candidate_sites.id", ondelete="CASCADE"), index=True)
    score_version: Mapped[str] = mapped_column(String(32))
    weights_json: Mapped[dict] = mapped_column(JSON, default=dict)
    sub_scores_json: Mapped[dict] = mapped_column(JSON, default=dict)
    coverage: Mapped[float | None] = mapped_column(Float, nullable=True)
    hard_constraints_json: Mapped[dict] = mapped_column(JSON, default=dict)
    calculated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class MetricResult(Base):
    __tablename__ = "metric_results"
    __table_args__ = (
        CheckConstraint(f"status IN ({_quoted(METRIC_STATUSES)})", name="ck_metric_results_status"),
        Index("ix_metric_results_site_indicator", "site_id", "indicator"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    site_id: Mapped[str] = mapped_column(ForeignKey("candidate_sites.id", ondelete="CASCADE"), index=True)
    indicator: Mapped[str] = mapped_column(String(100))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30))
    inputs_json: Mapped[dict] = mapped_column(JSON, default=dict)
    method: Mapped[str] = mapped_column(String(100))
    processing_version: Mapped[str] = mapped_column(String(32))
    calculated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    score_run_id: Mapped[str | None] = mapped_column(ForeignKey("score_runs.id", ondelete="SET NULL"), nullable=True)
