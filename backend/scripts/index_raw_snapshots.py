"""Build a deterministic, read-only inventory of raw gzip snapshots.

The index never changes the snapshot tree or SQLite database. It records both
the compressed-file digest and the digest of the uncompressed provider payload
so duplicate payloads can be reviewed even when gzip metadata differs.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sqlite3
from pathlib import Path
from typing import Any


DATE_PART = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _payload_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with gzip.open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _path_date(parts: tuple[str, ...]) -> str | None:
    return next((part for part in parts if DATE_PART.fullmatch(part)), None)


def _read_database(database_path: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    uri = f"file:{database_path.as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        snapshots = [
            dict(row)
            for row in connection.execute(
                "SELECT id, source_id, path, sha256, fetched_at FROM raw_snapshots ORDER BY id"
            )
        ]
        sources = {
            row["id"]: dict(row)
            for row in connection.execute(
                """SELECT id, licence, licence_url, can_cache, can_redistribute
                   FROM data_sources ORDER BY id"""
            )
        }
        return snapshots, sources
    finally:
        connection.close()


def build_raw_snapshot_index(database_path: Path, raw_dir: Path) -> dict[str, Any]:
    """Return the complete index without writing to the database or raw tree."""

    database_path = database_path.expanduser().resolve(strict=True)
    raw_dir = raw_dir.expanduser().resolve(strict=True)
    if not raw_dir.is_dir():
        raise ValueError("Raw snapshot root must be a directory")

    snapshots, sources = _read_database(database_path)
    snapshots_by_path: dict[str, list[dict[str, Any]]] = {}
    snapshots_by_hash: dict[str, list[dict[str, Any]]] = {}
    for snapshot in snapshots:
        stored_path = Path(str(snapshot["path"]))
        # Database paths are treated as inert relative identifiers. Traversal
        # entries are never resolved outside the audited root or path-matched.
        if not stored_path.is_absolute() and ".." not in stored_path.parts:
            snapshots_by_path.setdefault(stored_path.as_posix(), []).append(snapshot)
        snapshots_by_hash.setdefault(str(snapshot["sha256"]), []).append(snapshot)

    provisional: list[dict[str, Any]] = []
    for path in sorted(raw_dir.rglob("*.gz"), key=lambda item: item.relative_to(raw_dir).as_posix()):
        resolved = path.resolve(strict=True)
        if not resolved.is_relative_to(raw_dir):
            raise ValueError("Snapshot traversal outside the raw root is not allowed")
        relative = resolved.relative_to(raw_dir).as_posix()
        compressed_sha256 = _sha256_file(resolved)
        invalid_reason = None
        try:
            payload_sha256 = _payload_sha256(resolved)
        except (gzip.BadGzipFile, EOFError, OSError) as exc:
            payload_sha256 = None
            invalid_reason = type(exc).__name__

        parts = resolved.relative_to(raw_dir).parts
        inferred_source = parts[0] if parts else "unknown"
        exact_links = snapshots_by_path.get(relative, [])
        hash_links = snapshots_by_hash.get(payload_sha256 or "", [])
        if invalid_reason:
            linkage = "INVALID_GZIP"
            linked_rows: list[dict[str, Any]] = []
        elif exact_links and any(row["sha256"] == payload_sha256 for row in exact_links):
            linkage = "PATH_AND_PAYLOAD_HASH_MATCH"
            linked_rows = [row for row in exact_links if row["sha256"] == payload_sha256]
        elif hash_links:
            linkage = "PAYLOAD_HASH_MATCH_PATH_MISMATCH"
            linked_rows = hash_links
        elif exact_links:
            linkage = "PATH_MATCH_PAYLOAD_HASH_MISMATCH"
            linked_rows = exact_links
        else:
            linkage = "UNLINKED"
            linked_rows = []

        source = sources.get(inferred_source, {})
        fetched_times = sorted({str(row["fetched_at"]) for row in linked_rows if row.get("fetched_at")})
        path_date = _path_date(parts)
        provisional.append(
            {
                "relative_path": relative,
                "source_inference": inferred_source,
                "size_bytes": resolved.stat().st_size,
                "compressed_sha256": compressed_sha256,
                "payload_sha256": payload_sha256,
                "gzip_valid": invalid_reason is None,
                "invalid_reason": invalid_reason,
                "inferred_acquisition_time": fetched_times[0] if len(fetched_times) == 1 else path_date,
                "acquisition_time_basis": "database_fetched_at" if len(fetched_times) == 1 else ("path_date" if path_date else "unknown"),
                "database_linkage_status": linkage,
                "linked_snapshot_ids": sorted(str(row["id"]) for row in linked_rows),
                "licence": source.get("licence"),
                "licence_url": source.get("licence_url"),
                "source_can_cache": bool(source["can_cache"]) if "can_cache" in source else None,
                "source_can_redistribute": bool(source["can_redistribute"]) if "can_redistribute" in source else None,
                "retention_decision": "REVIEW_REQUIRED",
            }
        )

    payload_counts: dict[str, int] = {}
    for record in provisional:
        if record["payload_sha256"]:
            payload_counts[record["payload_sha256"]] = payload_counts.get(record["payload_sha256"], 0) + 1
    for record in provisional:
        payload_hash = record["payload_sha256"]
        record["duplicate_group"] = f"payload:{payload_hash}" if payload_hash else None
        record["duplicate_count"] = payload_counts.get(payload_hash, 0) if payload_hash else 0

    linkage_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    for record in provisional:
        linkage_counts[record["database_linkage_status"]] = linkage_counts.get(record["database_linkage_status"], 0) + 1
        source_counts[record["source_inference"]] = source_counts.get(record["source_inference"], 0) + 1
    return {
        "schema_version": 1,
        "database_snapshot_count": len(snapshots),
        "file_count": len(provisional),
        # A payload-hash candidate is useful for reconciliation, but it is not a
        # database link until a reviewer selects a concrete path.
        "unlinked_file_count": len(provisional) - linkage_counts.get("PATH_AND_PAYLOAD_HASH_MATCH", 0),
        "no_database_match_count": linkage_counts.get("UNLINKED", 0),
        "payload_hash_candidate_count": linkage_counts.get("PAYLOAD_HASH_MATCH_PATH_MISMATCH", 0),
        "exact_database_link_count": linkage_counts.get("PATH_AND_PAYLOAD_HASH_MATCH", 0),
        "invalid_gzip_count": linkage_counts.get("INVALID_GZIP", 0),
        "linkage_counts": dict(sorted(linkage_counts.items())),
        "source_counts": dict(sorted(source_counts.items())),
        "retention_policy_status": "REVIEW_REQUIRED",
        "records": provisional,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--raw-dir", required=True, type=Path)
    parser.add_argument("--output", type=Path, help="Optional JSON report path; snapshots and DB remain read-only")
    args = parser.parse_args()
    result = build_raw_snapshot_index(args.db, args.raw_dir)
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
