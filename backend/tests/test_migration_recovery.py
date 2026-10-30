"""Focused tests for the recovered 03b/03c migration lineage."""

import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from backend.app import db
from backend.app.data.models import DeveloperEvidence
from backend.app.models.legacy_facilities import LegacyFacility


ROOT = Path(__file__).resolve().parents[2]


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["db_path"] = path
    return config


class MigrationRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "recovery.db"

    def test_blank_database_reaches_recovered_head_and_matches_metadata(self):
        config = migration_config(self.path)
        command.upgrade(config, "head")
        command.check(config)

        engine = db.make_engine(self.path)
        try:
            with engine.connect() as connection:
                self.assertEqual(connection.scalar(text("SELECT version_num FROM alembic_version")), db.SCHEMA_REVISION)
                schema = inspect(connection)
                self.assertIn(DeveloperEvidence.__tablename__, schema.get_table_names())
                self.assertIn(LegacyFacility.__tablename__, schema.get_table_names())
                self.assertEqual(
                    {column["name"] for column in schema.get_columns("developer_evidence")},
                    {
                        "id", "site_id", "phase_id", "phase_revision", "revision", "evidence_status",
                        "document_reference", "document_sha256", "declared_by", "declared_on", "valid_until",
                        "measurement_boundary", "design_wue_l_per_kwh_it", "design_cue_kgco2_per_kwh",
                        "internal_reuse_fraction", "backup_generation_mw", "backup_fuel", "water_source_mix",
                        "asset_register", "notes", "created_at",
                    },
                )
                self.assertEqual(connection.scalar(text("PRAGMA integrity_check")), "ok")
        finally:
            engine.dispose()

    def test_03c_preserves_preexisting_legacy_rows_and_custom_indexes(self):
        config = migration_config(self.path)
        command.upgrade(config, "03b_001")
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute(
                """CREATE TABLE facilities (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
                    state TEXT NOT NULL, district TEXT NOT NULL, longitude REAL NOT NULL,
                    latitude REAL NOT NULL, risk_score INTEGER NOT NULL,
                    risk_level TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL
                )"""
            )
            connection.execute("CREATE INDEX custom_legacy_name ON facilities(name)")
            connection.execute(
                "INSERT INTO facilities VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                ("legacy-1", "Legacy", "substation", "MH", "Pune", 73.0, 18.5, 10, "low", "{}", "2026-10-29T00:00:00Z"),
            )
            before = connection.execute("SELECT * FROM facilities").fetchall()
            schema_before = connection.execute(
                "SELECT type,name,sql FROM sqlite_master WHERE tbl_name='facilities' ORDER BY type,name"
            ).fetchall()

        command.upgrade(config, "head")
        command.check(config)
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT version_num FROM alembic_version").fetchone()[0], db.SCHEMA_REVISION)
            self.assertEqual(connection.execute("SELECT * FROM facilities").fetchall(), before)
            self.assertEqual(
                connection.execute("SELECT type,name,sql FROM sqlite_master WHERE tbl_name='facilities' ORDER BY type,name").fetchall(),
                schema_before,
            )
            self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")

    def test_project_session_accepts_recovered_head(self):
        command.upgrade(migration_config(self.path), "head")
        with db.project_session(self.path) as session:
            self.assertEqual(session.scalar(text("SELECT COUNT(*) FROM projects")), 0)


if __name__ == "__main__":
    unittest.main()
