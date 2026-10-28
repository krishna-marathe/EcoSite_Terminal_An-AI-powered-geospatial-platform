"""Non-destructive hash classification and guarded path-repair tests."""

import gzip
import hashlib
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from backend.scripts.audit_raw_snapshots import audit_raw_snapshots


class RawSnapshotAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.raw = self.temp / "raw"
        self.raw.mkdir()
        self.db = self.temp / "snapshots.db"
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute(
                "CREATE TABLE raw_snapshots (id TEXT PRIMARY KEY, source_id TEXT, path TEXT, sha256 TEXT)"
            )

    def write_gzip(self, relative: str, payload: bytes) -> str:
        path = self.raw / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(path, "wb") as handle:
            handle.write(payload)
        return hashlib.sha256(payload).hexdigest()

    def add_snapshot(self, identifier: str, path: str, payload_sha256: str) -> None:
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute(
                "INSERT INTO raw_snapshots VALUES (?, ?, ?, ?)",
                (identifier, "synthetic_test_source", path, payload_sha256),
            )

    def test_audit_classifies_matches_and_orphans_without_mutation(self):
        match_hash = self.write_gzip("source/day/match.json.gz", b"matched synthetic payload")
        moved_hash = self.write_gzip("source/day/found.json.gz", b"moved synthetic payload")
        self.write_gzip("source/day/orphan.json.gz", b"orphan synthetic payload")
        self.add_snapshot("match", "source/day/match.json.gz", match_hash)
        self.add_snapshot("moved", "source/day/missing.json.gz", moved_hash)

        result = audit_raw_snapshots(self.db, self.raw)
        self.assertEqual(
            result["classification_counts"],
            {
                "path_and_payload_hash_match": 1,
                "unique_payload_hash_match_path_mismatch": 1,
            },
        )
        self.assertEqual(result["matched_file_count"], 2)
        self.assertEqual(result["orphan_file_count"], 1)
        self.assertEqual(result["repairs"], [])
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(
                connection.execute("SELECT path FROM raw_snapshots WHERE id='moved'").fetchone()[0],
                "source/day/missing.json.gz",
            )

    def test_repair_updates_only_unique_payload_hash_match(self):
        unique_hash = self.write_gzip("source/day/unique.json.gz", b"unique synthetic payload")
        duplicate_hash = self.write_gzip("source/day/duplicate-a.json.gz", b"duplicate synthetic payload")
        self.write_gzip("source/day/duplicate-b.json.gz", b"duplicate synthetic payload")
        self.add_snapshot("unique", "wrong/unique.json.gz", unique_hash)
        self.add_snapshot("ambiguous", "wrong/duplicate.json.gz", duplicate_hash)

        result = audit_raw_snapshots(self.db, self.raw, repair_db=True)
        self.assertEqual(result["classification_counts"]["unique_payload_hash_match_path_mismatch"], 1)
        self.assertEqual(result["classification_counts"]["ambiguous_payload_hash_match"], 1)
        self.assertEqual(len(result["repairs"]), 1)
        with closing(sqlite3.connect(self.db)) as connection:
            paths = dict(connection.execute("SELECT id, path FROM raw_snapshots"))
        self.assertEqual(paths["unique"], "source/day/unique.json.gz")
        self.assertEqual(paths["ambiguous"], "wrong/duplicate.json.gz")


if __name__ == "__main__":
    unittest.main()
