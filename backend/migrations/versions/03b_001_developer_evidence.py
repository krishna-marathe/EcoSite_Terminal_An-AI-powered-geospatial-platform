"""Restore phase-bound developer evidence and evidence foundation tables."""

from alembic import op
import sqlalchemy as sa


revision = "03b_001"
down_revision = "03a_001"
branch_labels = None
depends_on = None

EVIDENCE_STATUSES = "'declared', 'documented', 'verified', 'expired', 'superseded', 'conflicting', 'missing'"
DOCUMENT_TYPES = (
    "'DPR', 'UTILITY_APPLICATION', 'UTILITY_SANCTION', 'WATER_ALLOCATION', "
    "'WATER_STUDY', 'PLANNING', 'ENVIRONMENTAL_NOC', 'OTHER'"
)
VISIBILITIES = "'PROJECT_TEAM', 'RESTRICTED_REVIEWER', 'PUBLIC_SUMMARY'"
CONFIDENTIALITIES = "'public', 'aggregated_confidential', 'confidential'"
ASSERTION_SCOPES = "'CAMPUS', 'PHASE', 'SITE', 'CONNECTION'"
ASSERTION_STATUSES = (
    "'DECLARED', 'DOCUMENTED', 'VERIFIED_WITHIN_SCOPE', 'EXPIRED', "
    "'SUPERSEDED', 'CONFLICTING', 'MISSING'"
)
VERIFICATION_METHODS = (
    "'UNVERIFIED', 'EXTRACTED_RULE_BASED', 'EXTRACTED_MODEL', "
    "'SIMULATED_REVIEW', 'INDEPENDENT_REVIEW'"
)
REVIEW_STATUSES = "'APPROVED', 'REJECTED', 'FLAGGED_CONFLICT', 'SIMULATED_VERIFICATION'"


def upgrade():
    op.create_table(
        "developer_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phase_id", sa.String(36), sa.ForeignKey("project_phases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phase_revision", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("evidence_status", sa.String(20), nullable=False),
        sa.Column("document_reference", sa.String(300), nullable=False),
        sa.Column("document_sha256", sa.String(64), nullable=True),
        sa.Column("declared_by", sa.String(200), nullable=False),
        sa.Column("declared_on", sa.String(32), nullable=False),
        sa.Column("valid_until", sa.String(32), nullable=True),
        sa.Column("measurement_boundary", sa.String(500), nullable=False),
        sa.Column("design_wue_l_per_kwh_it", sa.Float(), nullable=True),
        sa.Column("design_cue_kgco2_per_kwh", sa.Float(), nullable=True),
        sa.Column("internal_reuse_fraction", sa.Float(), nullable=True),
        sa.Column("backup_generation_mw", sa.Float(), nullable=True),
        sa.Column("backup_fuel", sa.String(100), nullable=True),
        sa.Column("water_source_mix", sa.JSON(), nullable=True),
        sa.Column("asset_register", sa.JSON(), nullable=False),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_developer_evidence_revision"),
        sa.CheckConstraint("phase_revision >= 1", name="ck_developer_evidence_phase_revision"),
        sa.CheckConstraint(f"evidence_status IN ({EVIDENCE_STATUSES})", name="ck_developer_evidence_status"),
        sa.CheckConstraint("design_wue_l_per_kwh_it IS NULL OR design_wue_l_per_kwh_it >= 0", name="ck_developer_evidence_wue"),
        sa.CheckConstraint("design_cue_kgco2_per_kwh IS NULL OR design_cue_kgco2_per_kwh >= 0", name="ck_developer_evidence_cue"),
        sa.CheckConstraint(
            "internal_reuse_fraction IS NULL OR (internal_reuse_fraction >= 0 AND internal_reuse_fraction <= 1)",
            name="ck_developer_evidence_reuse",
        ),
        sa.CheckConstraint("backup_generation_mw IS NULL OR backup_generation_mw >= 0", name="ck_developer_evidence_backup"),
        sa.UniqueConstraint("phase_id", "revision", name="uq_developer_evidence_phase_revision"),
    )
    op.create_index("ix_developer_evidence_site_id", "developer_evidence", ["site_id"])
    op.create_index("ix_developer_evidence_phase_id", "developer_evidence", ["phase_id"])

    op.create_table(
        "evidence_artifacts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("issuer", sa.String(200), nullable=True),
        sa.Column("reference", sa.String(300), nullable=True),
        sa.Column("issued_on", sa.String(32), nullable=True),
        sa.Column("valid_until", sa.String(32), nullable=True),
        sa.Column("visibility", sa.String(30), nullable=False, server_default="PROJECT_TEAM"),
        sa.Column("confidentiality", sa.String(30), nullable=False, server_default="confidential"),
        sa.Column("synthetic_demo", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("uploaded_by", sa.String(200), nullable=False),
        sa.Column("uploaded_at", sa.String(32), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("revision >= 1", name="ck_evidence_artifacts_revision"),
        sa.CheckConstraint("status IN ('active', 'archived')", name="ck_evidence_artifacts_status"),
        sa.CheckConstraint(f"document_type IN ({DOCUMENT_TYPES})", name="ck_evidence_artifacts_type"),
        sa.CheckConstraint(f"visibility IN ({VISIBILITIES})", name="ck_evidence_artifacts_visibility"),
        sa.CheckConstraint(f"confidentiality IN ({CONFIDENTIALITIES})", name="ck_evidence_artifacts_confidentiality"),
        sa.CheckConstraint("file_size_bytes >= 0", name="ck_evidence_artifacts_size"),
    )
    op.create_index("ix_evidence_artifacts_project_id", "evidence_artifacts", ["project_id"])
    op.create_index("ix_evidence_artifacts_site_id", "evidence_artifacts", ["site_id"])
    op.create_index("ix_evidence_artifacts_document_type", "evidence_artifacts", ["document_type"])
    op.create_index("ix_evidence_artifacts_sha256", "evidence_artifacts", ["sha256"])
    op.create_index("ix_evidence_artifacts_status", "evidence_artifacts", ["status"])

    op.create_table(
        "assertions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("phase_id", sa.String(36), sa.ForeignKey("project_phases.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("field_key", sa.String(100), nullable=False),
        sa.Column("value", sa.String(500), nullable=False),
        sa.Column("numeric_value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("scope_type", sa.String(30), nullable=False, server_default="CAMPUS"),
        sa.Column("scope_detail", sa.String(200), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="DECLARED"),
        sa.Column("verification_method", sa.String(30), nullable=False, server_default="UNVERIFIED"),
        sa.Column("asserted_by", sa.String(200), nullable=False),
        sa.Column("asserted_at", sa.String(32), nullable=False),
        sa.Column("effective_from", sa.String(32), nullable=True),
        sa.Column("effective_to", sa.String(32), nullable=True),
        sa.Column("supersedes_assertion_id", sa.String(36), sa.ForeignKey("assertions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status_record", sa.String(20), nullable=False, server_default="active"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("revision >= 1", name="ck_assertions_revision"),
        sa.CheckConstraint("status_record IN ('active', 'archived')", name="ck_assertions_status_record"),
        sa.CheckConstraint(f"scope_type IN ({ASSERTION_SCOPES})", name="ck_assertions_scope"),
        sa.CheckConstraint(f"status IN ({ASSERTION_STATUSES})", name="ck_assertions_status"),
        sa.CheckConstraint(f"verification_method IN ({VERIFICATION_METHODS})", name="ck_assertions_verification"),
    )
    op.create_index("ix_assertions_project_id", "assertions", ["project_id"])
    op.create_index("ix_assertions_site_id", "assertions", ["site_id"])
    op.create_index("ix_assertions_phase_id", "assertions", ["phase_id"])
    op.create_index("ix_assertions_field_key", "assertions", ["field_key"])
    op.create_index("ix_assertions_status", "assertions", ["status"])
    op.create_index("ix_assertions_status_record", "assertions", ["status_record"])

    op.create_table(
        "assertion_evidence_links",
        sa.Column("assertion_id", sa.String(36), sa.ForeignKey("assertions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("artifact_id", sa.String(36), sa.ForeignKey("evidence_artifacts.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.CheckConstraint("page_number IS NULL OR page_number >= 1", name="ck_assertion_evidence_page"),
    )
    op.create_index("ix_assertion_evidence_links_artifact_id", "assertion_evidence_links", ["artifact_id"])

    op.create_table(
        "assertion_reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("assertion_id", sa.String(36), sa.ForeignKey("assertions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", sa.String(200), nullable=False),
        sa.Column("review_status", sa.String(30), nullable=False),
        sa.Column("is_simulated", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("notes", sa.String(2000), nullable=False),
        sa.Column("reviewed_at", sa.String(32), nullable=False),
        sa.CheckConstraint(f"review_status IN ({REVIEW_STATUSES})", name="ck_assertion_reviews_status"),
    )
    op.create_index("ix_assertion_reviews_assertion_id", "assertion_reviews", ["assertion_id"])


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")
