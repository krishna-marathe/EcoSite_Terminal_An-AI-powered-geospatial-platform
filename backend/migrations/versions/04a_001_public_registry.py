"""Add the normalized public operational-facility registry."""

from alembic import op
import sqlalchemy as sa


revision = "04a_001"
down_revision = "03c_001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "facility_operators",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("canonical_name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_facility_operators_name"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("canonical_name"),
    )

    op.create_table(
        "public_facilities",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("operator_id", sa.String(36), sa.ForeignKey("facility_operators.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("ownership_category", sa.String(20), nullable=False),
        sa.Column("facility_type", sa.String(20), nullable=False),
        sa.Column("state_code", sa.String(5), nullable=False),
        sa.Column("state_name", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("locality", sa.String(200), nullable=False),
        sa.Column("public_longitude", sa.Float(), nullable=False),
        sa.Column("public_latitude", sa.Float(), nullable=False),
        sa.Column("location_precision", sa.String(20), nullable=False),
        sa.Column("operational_since", sa.Integer(), nullable=True),
        sa.Column("registry_version", sa.String(64), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("temporal_class", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("ownership_category IN ('private', 'government', 'ppp', 'other', 'unknown')", name="ck_public_facilities_ownership"),
        sa.CheckConstraint("facility_type IN ('colocation', 'hyperscale', 'enterprise', 'edge', 'government', 'other')", name="ck_public_facilities_type"),
        sa.CheckConstraint("state_code IN ('IN-MH', 'IN-TG', 'IN-KA', 'IN-TN')", name="ck_public_facilities_state"),
        sa.CheckConstraint("location_precision IN ('locality', 'district')", name="ck_public_facilities_precision"),
        sa.CheckConstraint("public_longitude BETWEEN -180 AND 180", name="ck_public_facilities_longitude"),
        sa.CheckConstraint("public_latitude BETWEEN -90 AND 90", name="ck_public_facilities_latitude"),
        sa.CheckConstraint("operational_since IS NULL OR operational_since BETWEEN 1990 AND 2100", name="ck_public_facilities_operational_since"),
        sa.CheckConstraint("visibility = 'PUBLIC'", name="ck_public_facilities_visibility"),
        sa.CheckConstraint("temporal_class = 'STATIC_VERSIONED'", name="ck_public_facilities_temporal"),
    )
    op.create_index("ix_public_facilities_operator_id", "public_facilities", ["operator_id"])
    op.create_index("ix_public_facilities_facility_type", "public_facilities", ["facility_type"])
    op.create_index("ix_public_facilities_state_code", "public_facilities", ["state_code"])
    op.create_index("ix_public_facilities_city", "public_facilities", ["city"])

    op.create_table(
        "facility_aliases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias", sa.String(200), nullable=False),
        sa.Column("normalized_alias", sa.String(200), nullable=False),
        sa.Column("alias_type", sa.String(20), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("alias_type IN ('former_name', 'operator_name', 'campus_name', 'other')", name="ck_facility_aliases_type"),
        sa.UniqueConstraint("facility_id", "normalized_alias", name="uq_facility_aliases_facility_alias"),
    )
    op.create_index("ix_facility_aliases_facility_id", "facility_aliases", ["facility_id"])

    op.create_table(
        "facility_capacity_disclosures",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(8), nullable=False),
        sa.Column("capacity_type", sa.String(40), nullable=False),
        sa.Column("scope", sa.String(100), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("temporal_class", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("value > 0", name="ck_facility_capacity_value"),
        sa.CheckConstraint("unit IN ('MW', 'MVA')", name="ck_facility_capacity_unit"),
        sa.CheckConstraint("capacity_type IN ('it_load', 'total_power', 'power_capacity', 'power_capacity_unspecified')", name="ck_facility_capacity_type"),
        sa.CheckConstraint("length(trim(scope)) BETWEEN 1 AND 100", name="ck_facility_capacity_scope"),
        sa.UniqueConstraint("facility_id", "ordinal", name="uq_facility_capacity_ordinal"),
    )
    op.create_index("ix_facility_capacity_disclosures_facility_id", "facility_capacity_disclosures", ["facility_id"])

    op.create_table(
        "facility_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("publisher", sa.String(200), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("source_class", sa.String(32), nullable=False),
        sa.Column("retrieved_at", sa.String(10), nullable=False),
        sa.Column("evidence_class", sa.String(30), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("source_class IN ('government', 'operator', 'operator_factsheet', 'filing', 'certification', 'news', 'industry_publication', 'directory')", name="ck_facility_sources_class"),
        sa.CheckConstraint("evidence_class = 'DOCUMENTED'", name="ck_facility_sources_evidence"),
        sa.CheckConstraint("visibility = 'PUBLIC'", name="ck_facility_sources_visibility"),
        sa.UniqueConstraint("facility_id", "url", "retrieved_at", name="uq_facility_sources_retrieval"),
    )
    op.create_index("ix_facility_sources_facility_id", "facility_sources", ["facility_id"])

    op.create_table(
        "facility_verifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_id", sa.String(36), sa.ForeignKey("facility_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("verified_at", sa.String(10), nullable=False),
        sa.Column("expires_at", sa.String(10), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("status IN ('government_verified', 'public_operator_confirmed', 'credible_public_report')", name="ck_facility_verifications_status"),
        sa.CheckConstraint("date(expires_at) > date(verified_at)", name="ck_facility_verifications_order"),
        sa.CheckConstraint("julianday(expires_at) - julianday(verified_at) <= 90", name="ck_facility_verifications_window"),
        sa.UniqueConstraint("facility_id", "verified_at", "source_id", name="uq_facility_verifications_event"),
    )
    op.create_index("ix_facility_verifications_facility_id", "facility_verifications", ["facility_id"])
    op.create_index("ix_facility_verifications_source_id", "facility_verifications", ["source_id"])
    op.create_index("ix_facility_verifications_verified_at", "facility_verifications", ["verified_at"])
    op.create_index("ix_facility_verifications_expires_at", "facility_verifications", ["expires_at"])

    op.create_table(
        "public_facility_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("facility_id", sa.String(100), sa.ForeignKey("public_facilities.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("verification_id", sa.String(36), sa.ForeignKey("facility_verifications.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("registry_version", sa.String(64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("payload_sha256", sa.String(64), nullable=False),
        sa.Column("approval_basis", sa.String(32), nullable=False),
        sa.Column("approved_by", sa.String(200), nullable=False),
        sa.Column("approved_at", sa.String(32), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("approval_basis IN ('reviewed_public_seed', 'ministry_review')", name="ck_public_facility_snapshot_basis"),
        sa.CheckConstraint("visibility = 'PUBLIC'", name="ck_public_facility_snapshot_visibility"),
        sa.UniqueConstraint("facility_id", "registry_version", name="uq_public_facility_snapshot_version"),
    )
    op.create_index("ix_public_facility_snapshots_facility_id", "public_facility_snapshots", ["facility_id"])
    op.create_index("ix_public_facility_snapshots_verification_id", "public_facility_snapshots", ["verification_id"])
    op.create_index("ix_public_facility_snapshots_is_current", "public_facility_snapshots", ["is_current"])


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")

