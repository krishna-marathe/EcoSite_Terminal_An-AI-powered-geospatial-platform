# SQLite Database Operations Runbook

This runbook applies to the EcoTerminal SQLite store. Run commands from the repository root with the Python 3.11 project environment. Always pass an explicit database path; never test these procedures against the live file.

## Operating model

- Use one application process as the scheduled ingestion/retention writer. WAL permits concurrent readers, but independent job writers add avoidable contention.
- `journal_mode=WAL` persists. `busy_timeout` is connection-local; the backend sets it on every connection and the maintenance command reports its own value.
- Keep the database and its `-wal`/`-shm` files on local durable storage, not a network filesystem.
- Never copy a live database with a filesystem copy. The SQLite backup API below includes committed WAL content consistently.
- A job-lock table is deliberately deferred: no operational multi-worker scheduler currently needs database arbitration. Enforce one writer until that changes.

## Configure and check

During a maintenance window:

```powershell
backend\.venv\Scripts\python.exe -m backend.scripts.database_maintenance configure --db C:\explicit\path\ecosite.db --busy-timeout-ms 5000
backend\.venv\Scripts\python.exe -m backend.scripts.database_maintenance integrity --db C:\explicit\path\ecosite.db
```

Expect `journal_mode` to be `wal`. Proceed only when `ok` is true, integrity is `["ok"]`, and foreign-key violations are empty.

## Verified backup and restore drill

Output paths must be new; overwrite is refused. Store backups outside the application database directory when practical.

```powershell
backend\.venv\Scripts\python.exe -m backend.scripts.database_maintenance backup --db C:\explicit\path\ecosite.db --output D:\backups\ecositing-2026-10-29.db
backend\.venv\Scripts\python.exe -m backend.scripts.database_maintenance verify-restore --backup D:\backups\ecositing-2026-10-29.db --output C:\restore-drill\ecositing-check.db
```

Both commands verify integrity, foreign keys, and Alembic revision. Restore verification creates a separate copy and never replaces live data. For real recovery, stop all writers, preserve the damaged file, verify the chosen backup to a new path, and point deployment configuration at that verified path.

## Migration procedure

1. Stop ingestion and all application writers.
2. Run `integrity`; stop on failure.
3. Create a timestamped `backup` at a new path.
4. Run `verify-restore` into another new path.
5. Test the migration against a disposable backup copy with `ECOSITE_DB_PATH` explicitly set.
6. With writers still stopped, explicitly target the live database and run:

```powershell
backend\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
```

7. Run `integrity`, confirm the expected head, and run only reviewed idempotent importers required by the release.
8. Restart one writer, then readers; check for lock errors and validate API health.

Never stamp past a failed migration. Recover from the verified backup at a new path if rollback is required.

## Retention

- Raw high-frequency observations: 90 days.
- Hourly rollups: two years (730 days).
- Daily rollups: retained indefinitely.
- Raw provenance snapshots: no automatic deletion; retention depends on source licence and audit duties.

Planning is read-only and dry-run by default:

```powershell
backend\.venv\Scripts\python.exe -m backend.scripts.database_maintenance retention --db C:\explicit\path\ecosite.db --as-of 2026-10-29T00:00:00Z
```

After reviewing UTC cutoffs and counts, stop the writer and execute only with both safeguards:

```powershell
backend\.venv\Scripts\python.exe -m backend.scripts.database_maintenance retention --db C:\explicit\path\ecosite.db --as-of 2026-10-29T00:00:00Z --apply-retention --backup D:\backups\pre-retention-2026-10-29.db
```

Apply mode first creates and verifies the backup, then uses `BEGIN IMMEDIATE`, deletes only eligible raw/hourly rows, commits atomically, and runs a post-operation integrity check. This has not been run against the live database.
