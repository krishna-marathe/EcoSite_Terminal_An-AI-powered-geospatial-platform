"""Add project-wide cumulative development milestones."""
from alembic import op
import sqlalchemy as sa
revision = "02c_001"
down_revision = "02b_002"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("project_phases",
        sa.Column("id",sa.String(36),primary_key=True),
        sa.Column("project_id",sa.String(36),sa.ForeignKey("projects.id",ondelete="RESTRICT"),nullable=False),
        sa.Column("sequence",sa.Integer(),nullable=False),
        sa.Column("name",sa.String(200),nullable=False),
        sa.Column("commissioning_date",sa.Date(),nullable=False),
        sa.Column("cumulative_it_mw",sa.Float(),nullable=False),
        sa.Column("cumulative_facility_peak_mw",sa.Float(),nullable=False),
        sa.Column("design_pue",sa.Float(),nullable=False),
        sa.Column("average_water_kld",sa.Float(),nullable=False),
        sa.Column("peak_summer_water_kld",sa.Float(),nullable=False),
        sa.Column("cooling_type",sa.String(100),nullable=False),
        sa.Column("revision",sa.Integer(),nullable=False),
        sa.Column("status",sa.String(10),nullable=False),
        sa.Column("created_at",sa.String(32),nullable=False),
        sa.Column("updated_at",sa.String(32),nullable=False),
        sa.UniqueConstraint("project_id","sequence",name="uq_phase_sequence"),
        sa.CheckConstraint("sequence > 0 AND revision > 0",name="ck_phase_sequence_revision"),
        sa.CheckConstraint("cumulative_it_mw > 0 AND cumulative_facility_peak_mw >= cumulative_it_mw",name="ck_phase_loads"),
        sa.CheckConstraint("design_pue >= 1 AND average_water_kld >= 0 AND peak_summer_water_kld >= average_water_kld",name="ck_phase_resources"),
        sa.CheckConstraint("status IN ('active','archived')",name="ck_phase_status"))
    op.create_index("ix_project_phases_project_id","project_phases",["project_id"])

def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")
