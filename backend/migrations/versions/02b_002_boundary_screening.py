"""Retain screening provenance without reclassifying saved sites."""
from alembic import op
import sqlalchemy as sa
revision = "02b_002"
down_revision = "02b_001"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("candidate_sites", sa.Column("boundary_screening", sa.JSON(), nullable=False, server_default="{}"))

def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")
