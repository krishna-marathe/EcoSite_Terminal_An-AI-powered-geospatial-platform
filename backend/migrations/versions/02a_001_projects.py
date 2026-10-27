"""Add only local MVP projects; preserve all legacy tables."""
from alembic import op
import sqlalchemy as sa

revision = "02a_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("organization_label", sa.String(200), nullable=False),
        sa.Column("archetype", sa.String(20), nullable=False),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_projects_revision"),
        sa.CheckConstraint("status IN ('active', 'archived')", name="ck_projects_status"),
        sa.CheckConstraint("archetype IN ('enterprise', 'colocation', 'hyperscale', 'edge', 'other')", name="ck_projects_archetype"),
        sa.CheckConstraint("stage IN ('concept', 'feasibility', 'design', 'construction', 'operational')", name="ck_projects_stage"),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_projects_name"),
        sa.CheckConstraint("length(trim(organization_label)) BETWEEN 1 AND 200", name="ck_projects_organization"),
    )
    op.create_index("ix_projects_status", "projects", ["status"])


def downgrade():
    raise RuntimeError("Destructive project downgrade is disabled. Restore an approved backup instead.")
