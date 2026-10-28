"""Formalize the historical demo-facility table without replacing existing data."""

from alembic import op
import sqlalchemy as sa


revision = "03c_001"
down_revision = "03b_001"
branch_labels = None
depends_on = None


def upgrade():
    # Older databases created this compatibility table in application startup.
    # Preserve its rows, payloads and any user-created indexes exactly.
    if sa.inspect(op.get_bind()).has_table("facilities"):
        return
    # Keep the historical SQLite declarations byte-for-byte compatible. In
    # particular, SQLite reflects `id TEXT PRIMARY KEY` as nullable and the
    # coordinates as REAL; normal SQLAlchemy PK/Float declarations differ.
    op.execute(
        """CREATE TABLE facilities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            state TEXT NOT NULL,
            district TEXT NOT NULL,
            longitude REAL NOT NULL,
            latitude REAL NOT NULL,
            risk_score INTEGER NOT NULL,
            risk_level TEXT NOT NULL,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"""
    )


def downgrade():
    raise RuntimeError("Destructive downgrade is not supported; restore a reviewed backup.")

