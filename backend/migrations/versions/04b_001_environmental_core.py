"""Add station-linked public environmental observations and rollups."""

from alembic import op
import sqlalchemy as sa


revision = "04b_001"
down_revision = "04a_001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "metric_definitions",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("family", sa.String(40), nullable=False),
        sa.Column("canonical_unit", sa.String(32), nullable=False),
        sa.Column("value_kind", sa.String(16), nullable=False),
        sa.Column("preferred_aggregation", sa.String(24), nullable=False),
        sa.Column("default_range", sa.String(8), nullable=False),
        sa.Column("stale_after_seconds", sa.Integer(), nullable=False),
        sa.Column("valid_min", sa.Float(), nullable=True),
        sa.Column("valid_max", sa.Float(), nullable=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("value_kind IN ('numeric', 'category', 'index')", name="ck_metric_definitions_kind"),
        sa.CheckConstraint("default_range IN ('24h', '7d', '30d', '90d', '1y')", name="ck_metric_definitions_range"),
        sa.CheckConstraint("preferred_aggregation IN ('mean', 'min_max_mean', 'sum', 'latest', 'latest_max', 'vector_latest')", name="ck_metric_definitions_aggregation"),
        sa.CheckConstraint("stale_after_seconds > 0", name="ck_metric_definitions_stale"),
        sa.CheckConstraint("valid_min IS NULL OR valid_max IS NULL OR valid_max >= valid_min", name="ck_metric_definitions_bounds"),
    )
    op.create_index("ix_metric_definitions_family", "metric_definitions", ["family"])

    op.create_table(
        "monitoring_stations",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("native_station_id", sa.String(200), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("provider", sa.String(200), nullable=False),
        sa.Column("state_code", sa.String(5), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("locality", sa.String(200), nullable=True),
        sa.Column("public_longitude", sa.Float(), nullable=False),
        sa.Column("public_latitude", sa.Float(), nullable=False),
        sa.Column("station_type", sa.String(100), nullable=False),
        sa.Column("measured_metrics", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("first_seen_at", sa.String(32), nullable=True),
        sa.Column("last_seen_at", sa.String(32), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("public_longitude BETWEEN -180 AND 180", name="ck_monitoring_stations_longitude"),
        sa.CheckConstraint("public_latitude BETWEEN -90 AND 90", name="ck_monitoring_stations_latitude"),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'UNKNOWN')", name="ck_monitoring_stations_status"),
        sa.CheckConstraint("visibility = 'PUBLIC'", name="ck_monitoring_stations_visibility"),
        sa.UniqueConstraint("source_id", "native_station_id", name="uq_monitoring_stations_provider_key"),
    )
    op.create_index("ix_monitoring_stations_source_id", "monitoring_stations", ["source_id"])
    op.create_index("ix_monitoring_stations_state_code", "monitoring_stations", ["state_code"])

    op.create_table(
        "facility_station_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("station_id", sa.String(100), sa.ForeignKey("monitoring_stations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("metric_key", sa.String(64), sa.ForeignKey("metric_definitions.key", ondelete="RESTRICT"), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=False),
        sa.Column("selection_method", sa.String(40), nullable=False),
        sa.Column("effective_at", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.String(32), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("processing_version", sa.String(32), nullable=False),
        sa.Column("selection_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("distance_km >= 0", name="ck_facility_station_links_distance"),
        sa.CheckConstraint("selection_method IN ('nearest_eligible', 'same_district', 'manual_authority_mapping')", name="ck_facility_station_links_method"),
        sa.CheckConstraint("expires_at IS NULL OR expires_at > effective_at", name="ck_facility_station_links_window"),
        sa.UniqueConstraint("facility_id", "station_id", "metric_key", "effective_at", name="uq_facility_station_links_effective"),
    )
    op.create_index("ix_facility_station_links_facility_id", "facility_station_links", ["facility_id"])
    op.create_index("ix_facility_station_links_station_id", "facility_station_links", ["station_id"])
    op.create_index("ix_facility_station_links_metric_key", "facility_station_links", ["metric_key"])
    op.create_index("ix_facility_station_links_facility_metric", "facility_station_links", ["facility_id", "metric_key", "effective_at"])
    op.create_index("ix_facility_station_links_station_metric", "facility_station_links", ["station_id", "metric_key"])

    op.create_table(
        "environmental_observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("station_id", sa.String(100), sa.ForeignKey("monitoring_stations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metric_key", sa.String(64), sa.ForeignKey("metric_definitions.key", ondelete="RESTRICT"), nullable=False),
        sa.Column("ingestion_run_id", sa.String(36), sa.ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("raw_snapshot_id", sa.String(36), sa.ForeignKey("raw_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("category_value", sa.String(100), nullable=True),
        sa.Column("canonical_unit", sa.String(32), nullable=False),
        sa.Column("original_value", sa.Float(), nullable=True),
        sa.Column("original_category_value", sa.String(100), nullable=True),
        sa.Column("original_unit", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("quality", sa.String(20), nullable=False),
        sa.Column("evidence_class", sa.String(30), nullable=False),
        sa.Column("temporal_class", sa.String(24), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("observed_at", sa.String(32), nullable=True),
        sa.Column("published_at", sa.String(32), nullable=True),
        sa.Column("retrieved_at", sa.String(32), nullable=False),
        sa.Column("quality_flags", sa.JSON(), nullable=False),
        sa.Column("missing_reason", sa.String(500), nullable=True),
        sa.Column("provider_dedupe_key", sa.String(200), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("status IN ('AVAILABLE', 'PARTIAL', 'STALE', 'SOURCE_UNAVAILABLE', 'NOT_APPLICABLE', 'UNKNOWN')", name="ck_environmental_observations_status"),
        sa.CheckConstraint("quality IN ('preliminary', 'provisional', 'validated', 'unknown')", name="ck_environmental_observations_quality"),
        sa.CheckConstraint("temporal_class IN ('NEAR_REAL_TIME', 'PERIODIC', 'DERIVED')", name="ck_environmental_observations_temporal"),
        sa.CheckConstraint("visibility IN ('PUBLIC', 'MINISTRY', 'REGULATOR_RESTRICTED')", name="ck_environmental_observations_visibility"),
        sa.CheckConstraint("evidence_class IN ('MEASURED', 'AUTHORITY_VERIFIED', 'DOCUMENTED', 'MODELLED', 'UNAVAILABLE')", name="ck_environmental_observations_evidence"),
        sa.CheckConstraint(
            "(value IS NOT NULL AND category_value IS NULL AND missing_reason IS NULL) OR "
            "(value IS NULL AND category_value IS NOT NULL AND missing_reason IS NULL) OR "
            "(value IS NULL AND category_value IS NULL AND missing_reason IS NOT NULL)",
            name="ck_environmental_observations_value",
        ),
        sa.UniqueConstraint("source_id", "provider_dedupe_key", name="uq_environmental_observations_provider_dedupe"),
    )
    op.create_index("ix_environmental_observations_source_id", "environmental_observations", ["source_id"])
    op.create_index("ix_environmental_observations_station_id", "environmental_observations", ["station_id"])
    op.create_index("ix_environmental_observations_facility_id", "environmental_observations", ["facility_id"])
    op.create_index("ix_environmental_observations_metric_key", "environmental_observations", ["metric_key"])
    op.create_index("ix_environmental_observations_ingestion_run_id", "environmental_observations", ["ingestion_run_id"])
    op.create_index("ix_environmental_observations_station_metric_time", "environmental_observations", ["station_id", "metric_key", "observed_at"])
    op.create_index("ix_environmental_observations_facility_metric_time", "environmental_observations", ["facility_id", "metric_key", "observed_at"])
    op.create_index("ix_environmental_observations_source_retrieved", "environmental_observations", ["source_id", "retrieved_at"])

    op.create_table(
        "environmental_rollups",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("station_id", sa.String(100), sa.ForeignKey("monitoring_stations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_key", sa.String(64), sa.ForeignKey("metric_definitions.key", ondelete="RESTRICT"), nullable=False),
        sa.Column("interval", sa.String(8), nullable=False),
        sa.Column("bucket_start", sa.String(32), nullable=False),
        sa.Column("bucket_end", sa.String(32), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("minimum", sa.Float(), nullable=True),
        sa.Column("maximum", sa.Float(), nullable=True),
        sa.Column("total", sa.Float(), nullable=True),
        sa.Column("latest", sa.Float(), nullable=True),
        sa.Column("category_latest", sa.String(100), nullable=True),
        sa.Column("canonical_unit", sa.String(32), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("quality", sa.String(20), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("valid_sample_count", sa.Integer(), nullable=False),
        sa.Column("expected_sample_count", sa.Integer(), nullable=False),
        sa.Column("coverage_fraction", sa.Float(), nullable=False),
        sa.Column("quality_flags", sa.JSON(), nullable=False),
        sa.Column("processing_version", sa.String(32), nullable=False),
        sa.Column("generated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("interval IN ('hour', 'day')", name="ck_environmental_rollups_interval"),
        sa.CheckConstraint("bucket_end > bucket_start", name="ck_environmental_rollups_window"),
        sa.CheckConstraint("status IN ('AVAILABLE', 'PARTIAL', 'STALE', 'SOURCE_UNAVAILABLE', 'NOT_APPLICABLE', 'UNKNOWN')", name="ck_environmental_rollups_status"),
        sa.CheckConstraint("quality IN ('preliminary', 'provisional', 'validated', 'unknown')", name="ck_environmental_rollups_quality"),
        sa.CheckConstraint("sample_count >= 0 AND valid_sample_count >= 0 AND expected_sample_count >= 0", name="ck_environmental_rollups_counts"),
        sa.CheckConstraint("valid_sample_count <= sample_count", name="ck_environmental_rollups_valid_count"),
        sa.CheckConstraint("coverage_fraction BETWEEN 0 AND 1", name="ck_environmental_rollups_coverage"),
        sa.UniqueConstraint("station_id", "metric_key", "interval", "bucket_start", name="uq_environmental_rollups_bucket"),
    )
    op.create_index("ix_environmental_rollups_source_id", "environmental_rollups", ["source_id"])
    op.create_index("ix_environmental_rollups_station_id", "environmental_rollups", ["station_id"])
    op.create_index("ix_environmental_rollups_metric_key", "environmental_rollups", ["metric_key"])
    op.create_index("ix_environmental_rollups_metric_bucket_interval", "environmental_rollups", ["metric_key", "bucket_start", "interval"])
    op.create_index("ix_environmental_rollups_station_metric_bucket", "environmental_rollups", ["station_id", "metric_key", "bucket_start"])


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")

