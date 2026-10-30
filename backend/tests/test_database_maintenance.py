"""Disposable-database tests for SQLite operational maintenance."""

from __future__ import annotations

import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config

from backend.scripts.database_maintenance import (
    MaintenanceError,
    apply_retention,
    backup_database,
    configure_sqlite,
    integrity_report,
    retention_plan,
    verify_restore_copy,
)


ROOT = Path(__file__).resolve().parents[2]


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["db_path"] = path
    return config


class DatabaseMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.database = self.temp / "disposable.db"
        command.upgrade(migration_config(self.database), "head")

    def test_integrity_backup_and_restore_copy_preserve_revision_and_rows(self):
        with closing(sqlite3.connect(self.database)) as connection:
            connection.execute(
                "INSERT INTO operator_organisations "
                "(id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                ("org-maint", "Maintenance marker", "verified", "2026-10-29T00:00:00Z", "2026-10-29T00:00:00Z"),
            )
            connection.commit()
        report = integrity_report(self.database)
        self.assertTrue(report["ok"])
        self.assertEqual(report["schema_revision"], "04c_001")

        backup = self.temp / "backup.db"
        result = backup_database(self.database, backup)
        self.assertTrue(result["backup"]["ok"])
        restored = self.temp / "restored-check.db"
        restore = verify_restore_copy(backup, restored)
        self.assertTrue(restore["restored_copy"]["ok"])
        with closing(sqlite3.connect(restored)) as connection:
            self.assertEqual(connection.execute("SELECT name FROM operator_organisations WHERE id='org-maint'").fetchone()[0], "Maintenance marker")
        with self.assertRaises(MaintenanceError):
            backup_database(self.database, backup)

    def test_configure_enables_wal_and_reports_connection_timeout(self):
        result = configure_sqlite(self.database, 3210)
        self.assertEqual(result["journal_mode"].lower(), "wal")
        self.assertEqual(result["busy_timeout_ms"], 3210)
        with closing(sqlite3.connect(self.database)) as connection:
            self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0].lower(), "wal")

    def _seed_retention_fixture(self) -> None:
        values = {
            "source": ("maintenance-source", "Synthetic", "Test", "v1", "AUTHORITY", "P2", "manual", "none", None, None, "test", None, "test", 1, 0, 0, "point", "hourly", "tests", "tests", "v1", "never", "station", "VALIDATED", "none", "tests", "none", "NOT_CONNECTED", None, None, "synthetic", "2026-10-29T00:00:00Z", "2026-10-29T00:00:00Z"),
            "metric": ("temperature", "Temperature", "weather", "degC", "numeric", "mean", "24h", 3600, -100.0, 100.0, "Synthetic test metric", "2026-10-29T00:00:00Z", "2026-10-29T00:00:00Z"),
            "station": ("station-maint", "maintenance-source", "station-1", "Synthetic station", "Synthetic", None, None, None, 77.0, 20.0, "synthetic", "[]", "ACTIVE", None, None, "{}", "PUBLIC", "2026-10-29T00:00:00Z", "2026-10-29T00:00:00Z"),
        }
        with closing(sqlite3.connect(self.database)) as connection:
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("INSERT INTO data_sources VALUES (" + ",".join("?" for _ in values["source"]) + ")", values["source"])
            connection.execute("INSERT INTO metric_definitions VALUES (" + ",".join("?" for _ in values["metric"]) + ")", values["metric"])
            connection.execute("INSERT INTO monitoring_stations VALUES (" + ",".join("?" for _ in values["station"]) + ")", values["station"])
            observation_sql = """INSERT INTO environmental_observations
                (id, source_id, station_id, facility_id, metric_key, ingestion_run_id, raw_snapshot_id,
                 value, category_value, canonical_unit, original_value, original_category_value, original_unit,
                 status, quality, evidence_class, temporal_class, visibility, observed_at, published_at,
                 retrieved_at, quality_flags, missing_reason, provider_dedupe_key, created_at)
                VALUES (?, 'maintenance-source', 'station-maint', NULL, 'temperature', NULL, NULL,
                        25, NULL, 'degC', 25, NULL, 'degC', 'AVAILABLE', 'validated', 'MEASURED',
                        'NEAR_REAL_TIME', 'PUBLIC', ?, NULL, ?, '[]', NULL, ?, '2026-10-29T00:00:00Z')"""
            connection.execute(observation_sql, ("obs-old", "2026-01-01T00:00:00Z", "2026-01-01T00:01:00Z", "old"))
            connection.execute(observation_sql, ("obs-new", "2026-10-28T00:00:00Z", "2026-10-28T00:01:00Z", "new"))
            rollup_sql = """INSERT INTO environmental_rollups
                (id, source_id, station_id, metric_key, interval, bucket_start, bucket_end, value, minimum,
                 maximum, total, latest, category_latest, canonical_unit, status, quality, sample_count,
                 valid_sample_count, expected_sample_count, coverage_fraction, quality_flags, processing_version, generated_at)
                VALUES (?, 'maintenance-source', 'station-maint', 'temperature', ?, ?, ?, 25, 25, 25,
                        25, 25, NULL, 'degC', 'AVAILABLE', 'validated', 1, 1, 1, 1.0, '[]', 'test', '2026-10-29T00:00:00Z')"""
            connection.execute(rollup_sql, ("hour-old", "hour", "2023-01-01T00:00:00Z", "2023-01-01T01:00:00Z"))
            connection.execute(rollup_sql, ("hour-new", "hour", "2026-10-28T00:00:00Z", "2026-10-28T01:00:00Z"))
            connection.execute(rollup_sql, ("day-old", "day", "2020-01-01T00:00:00Z", "2020-01-02T00:00:00Z"))
            connection.commit()

    def test_retention_is_dry_run_by_default_and_apply_requires_verified_backup(self):
        self._seed_retention_fixture()
        as_of = datetime(2026, 10, 29, tzinfo=timezone.utc)
        plan = retention_plan(self.database, as_of)
        self.assertTrue(plan["dry_run"])
        self.assertEqual(plan["candidates"], {"environmental_observations": 1, "hourly_rollups": 1, "daily_rollups_retained": 1})
        with closing(sqlite3.connect(self.database)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM environmental_observations").fetchone()[0], 2)

        backup = self.temp / "pre-retention.db"
        result = apply_retention(self.database, as_of, backup)
        self.assertFalse(result["dry_run"])
        self.assertEqual(result["deleted"], {"environmental_observations": 1, "hourly_rollups": 1})
        with closing(sqlite3.connect(self.database)) as connection:
            self.assertEqual(connection.execute("SELECT group_concat(id) FROM environmental_observations").fetchone()[0], "obs-new")
            self.assertEqual(set(row[0] for row in connection.execute("SELECT id FROM environmental_rollups")), {"hour-new", "day-old"})
        with closing(sqlite3.connect(backup)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM environmental_observations").fetchone()[0], 2)
            self.assertEqual(connection.execute("SELECT count(*) FROM environmental_rollups").fetchone()[0], 3)


if __name__ == "__main__":
    unittest.main()
