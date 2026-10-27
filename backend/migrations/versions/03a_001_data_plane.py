"""Add the data-source registry, ingestion runs, snapshots and observations."""
from alembic import op
import sqlalchemy as sa

revision = "03a_001"
down_revision = "02c_001"
branch_labels = None
depends_on = None

ACCESS_METHODS = "'download', 'api', 'stac', 'wms', 'report', 'manual'"
DATA_CATEGORIES = "'GIS', 'OFFICIAL_ADMIN', 'POLICY', 'AUTHORITY', 'DEVELOPER'"
PRIORITIES = "'P0', 'P1', 'P2'"
TEST_STATUSES = "'DISCOVERED', 'ACCESS_TESTED', 'PROCESSING_TESTED', 'VALIDATED', 'INTEGRATED'"
RUNTIME_STATUSES = "'NOT_CONNECTED', 'CONNECTED', 'STALE', 'SOURCE_UNAVAILABLE'"
EVIDENCE_CLASSES = (
    "'MEASURED', 'AUTHORITY_VERIFIED', 'DECLARED', 'DOCUMENTED', 'OFFICIAL_GEOSPATIAL', "
    "'REMOTE_SENSING_DERIVED', 'MODELLED', 'CROWD_SOURCED', 'SYNTHETIC_DEMO', 'UNAVAILABLE'"
)
OBSERVATION_STATUSES = "'AVAILABLE', 'PARTIAL', 'STALE', 'SOURCE_UNAVAILABLE', 'NOT_APPLICABLE', 'UNKNOWN'"
RUN_STATUSES = "'success', 'partial', 'failed'"
EVIDENCE_STATUSES = "'declared', 'documented', 'verified', 'expired', 'superseded', 'conflicting', 'missing'"
METRIC_STATUSES = "'AVAILABLE', 'PARTIAL', 'STALE', 'SOURCE_UNAVAILABLE', 'UNKNOWN'"


def upgrade():
    op.create_table(
        "data_sources",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("provider", sa.String(200), nullable=False),
        sa.Column("dataset_name", sa.String(300), nullable=False),
        sa.Column("dataset_version", sa.String(64), nullable=False),
        sa.Column("data_category", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(4), nullable=False),
        sa.Column("access_method", sa.String(20), nullable=False),
        sa.Column("authentication", sa.String(300), nullable=False),
        sa.Column("base_url", sa.String(1000), nullable=True),
        sa.Column("exact_endpoint", sa.String(1000), nullable=True),
        sa.Column("licence", sa.String(300), nullable=False),
        sa.Column("licence_url", sa.String(1000), nullable=True),
        sa.Column("attribution", sa.String(300), nullable=False),
        sa.Column("can_cache", sa.Boolean(), nullable=False),
        sa.Column("can_redistribute", sa.Boolean(), nullable=False),
        sa.Column("commercial_use", sa.Boolean(), nullable=False),
        sa.Column("resolution", sa.String(300), nullable=False),
        sa.Column("temporal_resolution", sa.String(300), nullable=False),
        sa.Column("coverage", sa.String(500), nullable=False),
        sa.Column("observation_period", sa.String(200), nullable=False),
        sa.Column("latest_release", sa.String(100), nullable=False),
        sa.Column("update_frequency", sa.String(100), nullable=False),
        sa.Column("join_key_or_geometry", sa.String(300), nullable=False),
        sa.Column("test_status", sa.String(20), nullable=False),
        sa.Column("fallback", sa.String(500), nullable=False),
        sa.Column("owner", sa.String(100), nullable=False),
        sa.Column("next_action", sa.String(500), nullable=False),
        sa.Column("runtime_status", sa.String(30), nullable=False),
        sa.Column("last_checked_at", sa.String(32), nullable=True),
        sa.Column("last_success_at", sa.String(32), nullable=True),
        sa.Column("quality_notes", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint(f"access_method IN ({ACCESS_METHODS})", name="ck_data_sources_access"),
        sa.CheckConstraint(f"data_category IN ({DATA_CATEGORIES})", name="ck_data_sources_category"),
        sa.CheckConstraint(f"priority IN ({PRIORITIES})", name="ck_data_sources_priority"),
        sa.CheckConstraint(f"test_status IN ({TEST_STATUSES})", name="ck_data_sources_test_status"),
        sa.CheckConstraint(f"runtime_status IN ({RUNTIME_STATUSES})", name="ck_data_sources_runtime_status"),
    )

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("started_at", sa.String(32), nullable=False),
        sa.Column("finished_at", sa.String(32), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("bytes", sa.Integer(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("parser_version", sa.String(32), nullable=False),
        sa.Column("error", sa.String(2000), nullable=True),
        sa.CheckConstraint(f"status IN ({RUN_STATUSES})", name="ck_ingestion_runs_status"),
    )
    op.create_index("ix_ingestion_runs_source_id", "ingestion_runs", ["source_id"])

    op.create_table(
        "raw_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("ingestion_runs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("path", sa.String(1000), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("fetched_at", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.String(32), nullable=True),
    )
    op.create_index("ix_raw_snapshots_source_id", "raw_snapshots", ["source_id"])
    op.create_index("ix_raw_snapshots_run_id", "raw_snapshots", ["run_id"])

    op.create_table(
        "observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="SET NULL"), nullable=True),
        sa.Column("geometry_hash", sa.String(64), nullable=True),
        sa.Column("indicator", sa.String(100), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("evidence_class", sa.String(30), nullable=False),
        sa.Column("dataset_version", sa.String(64), nullable=False),
        sa.Column("period_start", sa.String(32), nullable=True),
        sa.Column("period_end", sa.String(32), nullable=True),
        sa.Column("observed_at", sa.String(32), nullable=True),
        sa.Column("published_at", sa.String(32), nullable=True),
        sa.Column("retrieved_at", sa.String(32), nullable=False),
        sa.Column("resolution", sa.String(200), nullable=False),
        sa.Column("method", sa.String(100), nullable=False),
        sa.Column("processing_version", sa.String(32), nullable=False),
        sa.Column("coverage_fraction", sa.Float(), nullable=True),
        sa.Column("quality_flags", sa.JSON(), nullable=False),
        sa.Column("missing_reason", sa.String(500), nullable=True),
        sa.Column("raw_snapshot_id", sa.String(36), sa.ForeignKey("raw_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dedupe_key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint(f"status IN ({OBSERVATION_STATUSES})", name="ck_observations_status"),
        sa.CheckConstraint(f"evidence_class IN ({EVIDENCE_CLASSES})", name="ck_observations_evidence"),
        sa.CheckConstraint(
            "coverage_fraction IS NULL OR (coverage_fraction >= 0 AND coverage_fraction <= 1)",
            name="ck_observations_coverage",
        ),
        sa.CheckConstraint("value IS NOT NULL OR missing_reason IS NOT NULL", name="ck_observations_missing_reason"),
        sa.UniqueConstraint("dedupe_key", name="uq_observations_dedupe"),
    )
    op.create_index("ix_observations_source_id", "observations", ["source_id"])
    op.create_index("ix_observations_site_id", "observations", ["site_id"])
    op.create_index("ix_observations_indicator", "observations", ["indicator"])
    op.create_index("ix_observations_source_site_indicator", "observations", ["source_id", "site_id", "indicator"])

    op.create_table(
        "authority_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field", sa.String(100), nullable=False),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("numeric_value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("evidence_status", sa.String(20), nullable=False),
        sa.Column("issuer", sa.String(200), nullable=False),
        sa.Column("reference", sa.String(300), nullable=False),
        sa.Column("issued_at", sa.String(32), nullable=True),
        sa.Column("valid_until", sa.String(32), nullable=True),
        sa.Column("file_sha256", sa.String(64), nullable=True),
        sa.Column("verified_at", sa.String(32), nullable=True),
        sa.Column("verified_by", sa.String(200), nullable=True),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint(f"evidence_status IN ({EVIDENCE_STATUSES})", name="ck_authority_evidence_status"),
    )
    op.create_index("ix_authority_evidence_site_id", "authority_evidence", ["site_id"])
    op.create_index("ix_authority_evidence_site_field", "authority_evidence", ["site_id", "field"])

    op.create_table(
        "score_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score_version", sa.String(32), nullable=False),
        sa.Column("weights_json", sa.JSON(), nullable=False),
        sa.Column("sub_scores_json", sa.JSON(), nullable=False),
        sa.Column("coverage", sa.Float(), nullable=True),
        sa.Column("hard_constraints_json", sa.JSON(), nullable=False),
        sa.Column("calculated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("coverage IS NULL OR (coverage >= 0 AND coverage <= 1)", name="ck_score_runs_coverage"),
    )
    op.create_index("ix_score_runs_site_id", "score_runs", ["site_id"])

    op.create_table(
        "metric_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("indicator", sa.String(100), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("inputs_json", sa.JSON(), nullable=False),
        sa.Column("method", sa.String(100), nullable=False),
        sa.Column("processing_version", sa.String(32), nullable=False),
        sa.Column("calculated_at", sa.String(32), nullable=False),
        sa.Column("score_run_id", sa.String(36), sa.ForeignKey("score_runs.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint(f"status IN ({METRIC_STATUSES})", name="ck_metric_results_status"),
    )
    op.create_index("ix_metric_results_site_id", "metric_results", ["site_id"])
    op.create_index("ix_metric_results_site_indicator", "metric_results", ["site_id", "indicator"])


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")
