"""Safe SQLite backup, restore verification, integrity and retention commands.

All commands require explicit paths. Retention is dry-run unless
`--apply-retention` is supplied, and apply mode requires creating a new verified
backup before the deletion transaction begins.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path


RAW_OBSERVATION_RETENTION_DAYS = 90
HOURLY_ROLLUP_RETENTION_DAYS = 365 * 2


class MaintenanceError(RuntimeError):
    pass


def resolved_existing_file(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise MaintenanceError(f"Database file does not exist: {resolved}")
    return resolved


def read_only_connection(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)


def schema_revision(connection: sqlite3.Connection) -> str | None:
    exists = connection.execute(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='alembic_version'"
    ).fetchone()[0]
    if not exists:
        return None
    row = connection.execute("SELECT version_num FROM alembic_version").fetchone()
    return row[0] if row else None


def integrity_report(database_path: Path) -> dict:
    database_path = resolved_existing_file(database_path)
    with closing(read_only_connection(database_path)) as connection:
        integrity_rows = [row[0] for row in connection.execute("PRAGMA integrity_check")]
        foreign_key_rows = [tuple(row) for row in connection.execute("PRAGMA foreign_key_check")]
        tables = connection.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
        revision = schema_revision(connection)
    return {
        "database": str(database_path),
        "size_bytes": database_path.stat().st_size,
        "schema_revision": revision,
        "table_count": tables,
        "integrity": integrity_rows,
        "foreign_key_violations": foreign_key_rows,
        "ok": integrity_rows == ["ok"] and not foreign_key_rows,
    }


def backup_database(source_path: Path, destination_path: Path) -> dict:
    source_path = resolved_existing_file(source_path)
    destination_path = destination_path.expanduser().resolve()
    if destination_path.exists():
        raise MaintenanceError(f"Refusing to overwrite backup destination: {destination_path}")
    if source_path == destination_path:
        raise MaintenanceError("Source and backup destination must differ")
    source_report = integrity_report(source_path)
    if not source_report["ok"]:
        raise MaintenanceError("Source database failed integrity or foreign-key checks")
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    source = read_only_connection(source_path)
    destination = sqlite3.connect(destination_path)
    try:
        source.backup(destination)
        destination.commit()
    except Exception:
        destination.close()
        source.close()
        if destination_path.exists():
            destination_path.unlink()
        raise
    else:
        destination.close()
        source.close()
    backup_report = integrity_report(destination_path)
    if not backup_report["ok"] or backup_report["schema_revision"] != source_report["schema_revision"]:
        raise MaintenanceError("Backup verification failed")
    return {"source": source_report, "backup": backup_report}


def verify_restore_copy(backup_path: Path, restored_copy_path: Path) -> dict:
    """Restore a backup into a new file and verify it without replacing a live DB."""
    result = backup_database(backup_path, restored_copy_path)
    return {"backup": result["source"], "restored_copy": result["backup"]}


def configure_sqlite(database_path: Path, busy_timeout_ms: int = 5000) -> dict:
    database_path = resolved_existing_file(database_path)
    if busy_timeout_ms < 1:
        raise MaintenanceError("busy timeout must be positive")
    with closing(sqlite3.connect(database_path)) as connection:
        journal_mode = connection.execute("PRAGMA journal_mode=WAL").fetchone()[0]
        connection.execute(f"PRAGMA busy_timeout={int(busy_timeout_ms)}")
        busy_timeout = connection.execute("PRAGMA busy_timeout").fetchone()[0]
        connection.commit()
    return {
        "database": str(database_path),
        "journal_mode": journal_mode,
        "busy_timeout_ms": busy_timeout,
        "note": "busy_timeout is connection-local; backend connections also set it on connect",
    }


def parse_as_of(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise MaintenanceError("--as-of must include a UTC offset or Z")
    return parsed.astimezone(timezone.utc)


def retention_cutoffs(as_of: datetime) -> tuple[str, str]:
    raw = (as_of - timedelta(days=RAW_OBSERVATION_RETENTION_DAYS)).isoformat().replace("+00:00", "Z")
    hourly = (as_of - timedelta(days=HOURLY_ROLLUP_RETENTION_DAYS)).isoformat().replace("+00:00", "Z")
    return raw, hourly


def retention_plan(database_path: Path, as_of: datetime) -> dict:
    database_path = resolved_existing_file(database_path)
    raw_cutoff, hourly_cutoff = retention_cutoffs(as_of)
    with closing(read_only_connection(database_path)) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        raw_count = 0
        hourly_count = 0
        daily_count = 0
        if "environmental_observations" in tables:
            raw_count = connection.execute(
                "SELECT count(*) FROM environmental_observations WHERE observed_at IS NOT NULL AND observed_at < ?",
                (raw_cutoff,),
            ).fetchone()[0]
        if "environmental_rollups" in tables:
            hourly_count = connection.execute(
                "SELECT count(*) FROM environmental_rollups WHERE interval='hour' AND bucket_end < ?",
                (hourly_cutoff,),
            ).fetchone()[0]
            daily_count = connection.execute(
                "SELECT count(*) FROM environmental_rollups WHERE interval='day'",
            ).fetchone()[0]
    return {
        "database": str(database_path),
        "as_of": as_of.isoformat().replace("+00:00", "Z"),
        "dry_run": True,
        "policy": {
            "raw_observation_days": RAW_OBSERVATION_RETENTION_DAYS,
            "hourly_rollup_days": HOURLY_ROLLUP_RETENTION_DAYS,
            "daily_rollups": "retain",
            "raw_snapshots": "source_and_licence_specific_no_automatic_deletion",
        },
        "cutoffs": {"raw_observations_before": raw_cutoff, "hourly_rollups_before": hourly_cutoff},
        "candidates": {
            "environmental_observations": raw_count,
            "hourly_rollups": hourly_count,
            "daily_rollups_retained": daily_count,
        },
    }


def apply_retention(database_path: Path, as_of: datetime, backup_path: Path) -> dict:
    database_path = resolved_existing_file(database_path)
    backup_result = backup_database(database_path, backup_path)
    plan = retention_plan(database_path, as_of)
    raw_cutoff = plan["cutoffs"]["raw_observations_before"]
    hourly_cutoff = plan["cutoffs"]["hourly_rollups_before"]
    connection = sqlite3.connect(database_path)
    try:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=5000")
        connection.execute("BEGIN IMMEDIATE")
        raw_deleted = connection.execute(
            "DELETE FROM environmental_observations WHERE observed_at IS NOT NULL AND observed_at < ?",
            (raw_cutoff,),
        ).rowcount
        hourly_deleted = connection.execute(
            "DELETE FROM environmental_rollups WHERE interval='hour' AND bucket_end < ?",
            (hourly_cutoff,),
        ).rowcount
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    after = integrity_report(database_path)
    if not after["ok"]:
        raise MaintenanceError("Post-retention integrity verification failed; restore the verified backup")
    return {
        "plan": plan,
        "dry_run": False,
        "deleted": {"environmental_observations": raw_deleted, "hourly_rollups": hourly_deleted},
        "verified_backup": backup_result["backup"],
        "database_after": after,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    integrity = subparsers.add_parser("integrity", help="Run read-only integrity and FK checks")
    integrity.add_argument("--db", required=True, type=Path)

    backup = subparsers.add_parser("backup", help="Create and verify a new backup without overwrite")
    backup.add_argument("--db", required=True, type=Path)
    backup.add_argument("--output", required=True, type=Path)

    restore = subparsers.add_parser("verify-restore", help="Restore backup to a new file and verify it")
    restore.add_argument("--backup", required=True, type=Path)
    restore.add_argument("--output", required=True, type=Path)

    configure = subparsers.add_parser("configure", help="Enable WAL and report busy timeout")
    configure.add_argument("--db", required=True, type=Path)
    configure.add_argument("--busy-timeout-ms", type=int, default=5000)

    retention = subparsers.add_parser("retention", help="Plan retention; apply only with explicit flag and backup")
    retention.add_argument("--db", required=True, type=Path)
    retention.add_argument("--as-of", required=True, help="UTC ISO-8601 instant")
    retention.add_argument("--apply-retention", action="store_true")
    retention.add_argument("--backup", type=Path, help="Required new backup destination in apply mode")

    args = parser.parse_args()
    if args.command == "integrity":
        result = integrity_report(args.db)
    elif args.command == "backup":
        result = backup_database(args.db, args.output)
    elif args.command == "verify-restore":
        result = verify_restore_copy(args.backup, args.output)
    elif args.command == "configure":
        result = configure_sqlite(args.db, args.busy_timeout_ms)
    else:
        as_of = parse_as_of(args.as_of)
        if args.apply_retention:
            if args.backup is None:
                parser.error("retention --apply-retention requires --backup pointing to a new file")
            result = apply_retention(args.db, as_of, args.backup)
        else:
            result = retention_plan(args.db, as_of)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
