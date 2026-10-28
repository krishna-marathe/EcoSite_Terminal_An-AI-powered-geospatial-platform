"""Read-only raw snapshot classification index tests."""

import gzip
import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from backend.scripts.index_raw_snapshots import build_raw_snapshot_index


class RawSnapshotIndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.raw = self.temp / "raw"
        self.raw.mkdir()
        self.db = self.temp / "index.db"
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.executescript(
                """
                CREATE TABLE data_sources (
                  id TEXT PRIMARY KEY, licence TEXT, licence_url TEXT,
                  can_cache INTEGER, can_redistribute INTEGER
                );
                CREATE TABLE raw_snapshots (
                  id TEXT PRIMARY KEY, source_id TEXT, path TEXT,
                  sha256 TEXT, fetched_at TEXT
                );
                INSERT INTO data_sources VALUES
                  ('source_a', 'Test licence', 'https://example.test/licence', 1, 0);
                """
            )

    def write_gzip(self, relative: str, payload: bytes) -> tuple[Path, str]:
        path = self.raw / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as raw_handle, gzip.GzipFile(fileobj=raw_handle, mode="wb", mtime=0) as handle:
            handle.write(payload)
        return path, hashlib.sha256(payload).hexdigest()

    def test_indexes_linkage_duplicates_licence_and_path_date_without_mutation(self):
        linked, payload_hash = self.write_gzip("source_a/2026-10-27/linked.json.gz", b"same payload")
        duplicate, _ = self.write_gzip("source_a/2026-10-27/duplicate.json.gz", b"same payload")
        unlinked, _ = self.write_gzip("unknown_source/2026-10-28/orphan.json.gz", b"orphan")
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute(
                "INSERT INTO raw_snapshots VALUES (?, ?, ?, ?, ?)",
                ("snap-1", "source_a", "source_a/2026-10-27/linked.json.gz", payload_hash, "2026-10-27T12:00:00Z"),
            )
        before = {path: path.read_bytes() for path in (linked, duplicate, unlinked)}
        before_db = self.db.read_bytes()

        result = build_raw_snapshot_index(self.db, self.raw)

        self.assertEqual(result["file_count"], 3)
        self.assertEqual(result["unlinked_file_count"], 2)
        self.assertEqual(result["no_database_match_count"], 1)
        self.assertEqual(result["payload_hash_candidate_count"], 1)
        records = {item["relative_path"]: item for item in result["records"]}
        exact = records["source_a/2026-10-27/linked.json.gz"]
        self.assertEqual(exact["database_linkage_status"], "PATH_AND_PAYLOAD_HASH_MATCH")
        self.assertEqual(exact["acquisition_time_basis"], "database_fetched_at")
        self.assertEqual(exact["duplicate_count"], 2)
        self.assertEqual(exact["licence"], "Test licence")
        self.assertEqual(exact["retention_decision"], "REVIEW_REQUIRED")
        self.assertEqual(records["source_a/2026-10-27/duplicate.json.gz"]["database_linkage_status"], "PAYLOAD_HASH_MATCH_PATH_MISMATCH")
        orphan = records["unknown_source/2026-10-28/orphan.json.gz"]
        self.assertEqual(orphan["database_linkage_status"], "UNLINKED")
        self.assertEqual(orphan["inferred_acquisition_time"], "2026-10-28")
        self.assertIsNone(orphan["licence"])
        self.assertEqual(before_db, self.db.read_bytes())
        self.assertEqual(before, {path: path.read_bytes() for path in before})

        # The result is stable and contains no machine-specific absolute paths.
        rerun = build_raw_snapshot_index(self.db, self.raw)
        self.assertEqual(json.dumps(result, sort_keys=True), json.dumps(rerun, sort_keys=True))
        self.assertNotIn(str(self.temp), json.dumps(result))

    def test_invalid_gzip_and_traversal_database_path_are_safely_classified(self):
        invalid = self.raw / "source_a" / "2026-10-27" / "invalid.json.gz"
        invalid.parent.mkdir(parents=True)
        invalid.write_bytes(b"not gzip")
        payload_hash = hashlib.sha256(b"not gzip").hexdigest()
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute(
                "INSERT INTO raw_snapshots VALUES (?, ?, ?, ?, ?)",
                ("unsafe", "source_a", "../outside.json.gz", payload_hash, "2026-10-27T12:00:00Z"),
            )

        result = build_raw_snapshot_index(self.db, self.raw)

        self.assertEqual(result["invalid_gzip_count"], 1)
        record = result["records"][0]
        self.assertEqual(record["database_linkage_status"], "INVALID_GZIP")
        self.assertFalse(record["gzip_valid"])
        self.assertEqual(record["retention_decision"], "REVIEW_REQUIRED")


if __name__ == "__main__":
    unittest.main()
