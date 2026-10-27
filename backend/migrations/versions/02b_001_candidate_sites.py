"""Add candidate polygons; enforce the active limit even for direct SQL writes."""
from alembic import op
import sqlalchemy as sa

revision = "02b_001"
down_revision = "02a_001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("candidate_sites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("geometry", sa.JSON(), nullable=False),
        sa.Column("area_ha", sa.Float(), nullable=False),
        sa.Column("state_code", sa.String(5), nullable=False),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("geometry_hash", sa.String(64), nullable=False),
        sa.Column("boundary_sha256", sa.String(64), nullable=False),
        sa.Column("boundary_source", sa.String(500), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.String(32), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_sites_revision"),
        sa.CheckConstraint("status IN ('active', 'archived')", name="ck_sites_status"),
        sa.CheckConstraint("area_ha > 0", name="ck_sites_area"),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_sites_name"),
    )
    op.create_index("ix_candidate_sites_project_id", "candidate_sites", ["project_id"])
    for event in ("INSERT", "UPDATE OF status, project_id"):
        name = "candidate_limit_insert" if event == "INSERT" else "candidate_limit_update"
        op.execute(f"""CREATE TRIGGER {name} BEFORE {event} ON candidate_sites
            WHEN NEW.status = 'active' AND
            (SELECT count(*) FROM candidate_sites WHERE project_id=NEW.project_id AND status='active' AND id != NEW.id) >= 3
            BEGIN SELECT RAISE(ABORT, 'candidate_limit'); END""")


def downgrade():
    raise RuntimeError("Destructive candidate downgrade is disabled. Restore an approved backup.")
