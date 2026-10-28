"""Restore phase-bound developer evidence present in the reviewed runtime schema."""

from alembic import op
import sqlalchemy as sa


revision = "03b_001"
down_revision = "03a_001"
branch_labels = None
depends_on = None

EVIDENCE_STATUSES = "'declared', 'documented', 'verified', 'expired', 'superseded', 'conflicting', 'missing'"


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


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")

