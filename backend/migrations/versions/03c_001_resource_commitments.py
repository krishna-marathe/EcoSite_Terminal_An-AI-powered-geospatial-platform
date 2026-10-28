"""Add power_commitments and water_commitments tables for Phase C.1."""
from alembic import op
import sqlalchemy as sa

revision = "03c_001"
down_revision = "03b_001"
branch_labels = None
depends_on = None

POWER_COMMITMENT_TYPES = (
    "'GRID_SANCTION', 'GRID_ENERGIZED', 'GRID_ALLOCATION_PROPOSED', 'GRID_REQUESTED', "
    "'CAPTIVE_RENEWABLE', 'UNKNOWN_AVAILABILITY'"
)
POWER_COMMITMENT_STATUSES = (
    "'REQUESTED', 'PROPOSED', 'SANCTIONED', 'ENERGIZED', 'EXPIRED', 'CANCELLED', 'UNKNOWN'"
)
WATER_SOURCE_TYPES = (
    "'MUNICIPAL_PIPED', 'INDUSTRIAL_RECYCLED', 'SURFACE_WATER_IRRIGATION', "
    "'GROUNDWATER_NOC', 'RAINWATER_HARVESTING', 'UNKNOWN'"
)
WATER_COMMITMENT_STATUSES = (
    "'PROPOSED', 'ALLOCATED', 'OPERATIONAL', 'EXPIRED', 'CANCELLED', 'UNKNOWN'"
)
RESOURCE_SCOPE_TYPES = "'CAMPUS', 'PHASE', 'SITE'"
VERIFICATION_STATES = "'UNVERIFIED', 'DOCUMENTED', 'VERIFIED', 'SIMULATED'"


def upgrade():
    op.create_table(
        "power_commitments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("phase_id", sa.String(36), sa.ForeignKey("project_phases.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("scope_type", sa.String(20), nullable=False, server_default="CAMPUS"),
        sa.Column("commitment_type", sa.String(40), nullable=False, server_default="GRID_SANCTION"),
        sa.Column("capacity_mw", sa.Float(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PROPOSED"),
        sa.Column("utility_provider", sa.String(200), nullable=True),
        sa.Column("substation_name", sa.String(200), nullable=True),
        sa.Column("voltage_kv", sa.Float(), nullable=True),
        sa.Column("effective_date", sa.String(32), nullable=True),
        sa.Column("expiry_date", sa.String(32), nullable=True),
        sa.Column("evidence_artifact_id", sa.String(36), sa.ForeignKey("evidence_artifacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assertion_id", sa.String(36), sa.ForeignKey("assertions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("verification_state", sa.String(30), nullable=False, server_default="UNVERIFIED"),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status_record", sa.String(10), nullable=False, server_default="active"),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_power_commitments_revision"),
        sa.CheckConstraint("status_record IN ('active', 'archived')", name="ck_power_commitments_status_record"),
        sa.CheckConstraint("capacity_mw >= 0", name="ck_power_commitments_capacity"),
        sa.CheckConstraint(f"commitment_type IN ({POWER_COMMITMENT_TYPES})", name="ck_power_commitments_type"),
        sa.CheckConstraint(f"status IN ({POWER_COMMITMENT_STATUSES})", name="ck_power_commitments_status"),
        sa.CheckConstraint(f"scope_type IN ({RESOURCE_SCOPE_TYPES})", name="ck_power_commitments_scope"),
        sa.CheckConstraint(f"verification_state IN ({VERIFICATION_STATES})", name="ck_power_commitments_verification"),
    )
    op.create_index("ix_power_commitments_project_id", "power_commitments", ["project_id"])
    op.create_index("ix_power_commitments_site_id", "power_commitments", ["site_id"])
    op.create_index("ix_power_commitments_phase_id", "power_commitments", ["phase_id"])
    op.create_index("ix_power_commitments_evidence_artifact_id", "power_commitments", ["evidence_artifact_id"])
    op.create_index("ix_power_commitments_assertion_id", "power_commitments", ["assertion_id"])
    op.create_index("ix_power_commitments_status", "power_commitments", ["status"])
    op.create_index("ix_power_commitments_status_record", "power_commitments", ["status_record"])

    op.create_table(
        "water_commitments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("phase_id", sa.String(36), sa.ForeignKey("project_phases.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("scope_type", sa.String(20), nullable=False, server_default="CAMPUS"),
        sa.Column("source_type", sa.String(40), nullable=False, server_default="MUNICIPAL_PIPED"),
        sa.Column("allocated_kld", sa.Float(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PROPOSED"),
        sa.Column("authority_issuer", sa.String(200), nullable=True),
        sa.Column("allocation_reference", sa.String(300), nullable=True),
        sa.Column("effective_date", sa.String(32), nullable=True),
        sa.Column("expiry_date", sa.String(32), nullable=True),
        sa.Column("evidence_artifact_id", sa.String(36), sa.ForeignKey("evidence_artifacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assertion_id", sa.String(36), sa.ForeignKey("assertions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("verification_state", sa.String(30), nullable=False, server_default="UNVERIFIED"),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status_record", sa.String(10), nullable=False, server_default="active"),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_water_commitments_revision"),
        sa.CheckConstraint("status_record IN ('active', 'archived')", name="ck_water_commitments_status_record"),
        sa.CheckConstraint("allocated_kld >= 0", name="ck_water_commitments_quantity"),
        sa.CheckConstraint(f"source_type IN ({WATER_SOURCE_TYPES})", name="ck_water_commitments_source"),
        sa.CheckConstraint(f"status IN ({WATER_COMMITMENT_STATUSES})", name="ck_water_commitments_status"),
        sa.CheckConstraint(f"scope_type IN ({RESOURCE_SCOPE_TYPES})", name="ck_water_commitments_scope"),
        sa.CheckConstraint(f"verification_state IN ({VERIFICATION_STATES})", name="ck_water_commitments_verification"),
    )
    op.create_index("ix_water_commitments_project_id", "water_commitments", ["project_id"])
    op.create_index("ix_water_commitments_site_id", "water_commitments", ["site_id"])
    op.create_index("ix_water_commitments_phase_id", "water_commitments", ["phase_id"])
    op.create_index("ix_water_commitments_evidence_artifact_id", "water_commitments", ["evidence_artifact_id"])
    op.create_index("ix_water_commitments_assertion_id", "water_commitments", ["assertion_id"])
    op.create_index("ix_water_commitments_status", "water_commitments", ["status"])
    op.create_index("ix_water_commitments_status_record", "water_commitments", ["status_record"])


def downgrade():
    op.drop_table("water_commitments")
    op.drop_table("power_commitments")
