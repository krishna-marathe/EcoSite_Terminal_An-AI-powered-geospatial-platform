"""Audit gzip snapshots against SQLite payload hashes without deleting data.

`raw_snapshots.sha256` hashes the uncompressed provider payload. The audit
reports compressed and payload hashes. Path repair is opt-in and allowed only
for a unique payload-hash match.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sqlite3
from pathlib import Path


def file_hashes(path: Path) -> tuple[str, str]:
    compressed = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            compressed.update(block)
    payload = hashlib.sha256()
    with gzip.open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            payload.update(block)
    return compressed.hexdigest(), payload.hexdigest()


def audit_raw_snapshots(database_path: Path, raw_dir: Path, *, repair_db: bool = False) -> dict:
    database_path = database_path.expanduser().resolve()
    raw_dir = raw_dir.expanduser().resolve()
    files = sorted(path for path in raw_dir.rglob("*") if path.is_file())
    file_records = []
    by_payload_hash: dict[str, list[dict]] = {}
    invalid_gzip = []
    for path in files:
        relative = path.relative_to(raw_dir).as_posix()
        try:
            compressed_sha256, payload_sha256 = file_hashes(path)
        except (gzip.BadGzipFile, EOFError, OSError) as exc:
            invalid_gzip.append({"path": relative, "error": type(exc).__name__})
            continue
        record = {
            "path": relative,
            "size_bytes": path.stat().st_size,
            "compressed_sha256": compressed_sha256,
            "payload_sha256": payload_sha256,
        }
        file_records.append(record)
        by_payload_hash.setdefault(payload_sha256, []).append(record)

    mode = "rw" if repair_db else "ro"
    uri = f"file:{database_path.as_posix()}?mode={mode}"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        snapshots = [dict(row) for row in connection.execute(
            "SELECT id, source_id, path, sha256 FROM raw_snapshots ORDER BY id"
        )]
        classifications = []
        repairs = []
        matched_paths = set()
        for snapshot in snapshots:
            expected_path = (raw_dir / Path(snapshot["path"])).resolve()
            candidates = by_payload_hash.get(snapshot["sha256"], [])
            expected_match = next(
                (item for item in candidates if (raw_dir / Path(item["path"])).resolve() == expected_path),
                None,
            )
            if expected_match is not None:
                classification = "path_and_payload_hash_match"
                matched_paths.add(expected_match["path"])
            elif len(candidates) == 1:
                classification = "unique_payload_hash_match_path_mismatch"
                matched_paths.add(candidates[0]["path"])
                if repair_db:
                    connection.execute(
                        "UPDATE raw_snapshots SET path = ? WHERE id = ? AND sha256 = ?",
                        (candidates[0]["path"], snapshot["id"], snapshot["sha256"]),
                    )
                    repairs.append({
                        "snapshot_id": snapshot["id"],
                        "old_path": snapshot["path"],
                        "new_path": candidates[0]["path"],
                    })
            elif len(candidates) > 1:
                classification = "ambiguous_payload_hash_match"
            else:
                classification = "missing_payload_hash_match"
            classifications.append({
                "snapshot_id": snapshot["id"],
                "source_id": snapshot["source_id"],
                "stored_path": snapshot["path"],
                "stored_payload_sha256": snapshot["sha256"],
                "classification": classification,
                "candidate_paths": [item["path"] for item in candidates],
            })
        if repair_db:
            connection.commit()

        orphan_paths = sorted(item["path"] for item in file_records if item["path"] not in matched_paths)
        counts: dict[str, int] = {}
        for item in classifications:
            counts[item["classification"]] = counts.get(item["classification"], 0) + 1
        return {
            "database": str(database_path),
            "raw_dir": str(raw_dir),
            "repair_requested": repair_db,
            "snapshot_count": len(snapshots),
            "gzip_file_count": len(files),
            "valid_gzip_file_count": len(file_records),
            "invalid_gzip_count": len(invalid_gzip),
            "classification_counts": counts,
            "snapshots": classifications,
            "matched_file_count": len(matched_paths),
            "orphan_file_count": len(orphan_paths),
            "orphan_paths": orphan_paths,
            "invalid_gzip": invalid_gzip,
            "repairs": repairs,
        }
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path, help="SQLite database to audit")
    parser.add_argument("--raw-dir", required=True, type=Path, help="Root containing gzip snapshots")
    parser.add_argument(
        "--repair-db",
        action="store_true",
        help="Repair only uniquely hash-matched paths; never moves or deletes files",
    )
    parser.add_argument("--summary-only", action="store_true", help="Omit the orphan path list")
    args = parser.parse_args()
    result = audit_raw_snapshots(args.db, args.raw_dir, repair_db=args.repair_db)
    if args.summary_only:
        result["orphan_paths"] = []
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
