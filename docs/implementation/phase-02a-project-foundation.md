# Phase 02A — local Project database foundation

This checkpoint adds backend Project persistence only. No project UI, candidate polygons,
development phases, GIS, evidence scoring or Passport is implemented. Existing frontend,
legacy facilities and browser storage contracts remain intact.

## Local-only boundary

There is no authentication, owner or tenant enforcement. The organization_label is
user-entered descriptive text, never an identity or proof of ownership. All project
records belong to one local developer. Do not expose the service publicly, bind it
to a LAN address, or put it behind a public proxy. Project endpoints require a
loopback client and Host, and reject browser Origins outside the configured local
CORS origins (or the same local origin). These checks are not multi-user security.
Use Uvicorn with --host 127.0.0.1 --no-proxy-headers. Browser clients must use an
explicit matching local ECOSITE_CORS_ORIGINS value; there is no wildcard origin gate.
The pre-existing legacy APIs retain their existing access behavior.

## Installation and safe migration rehearsal

SQLAlchemy==2.0.44 and alembic==1.17.1 are pinned in backend/requirements.txt;
Python 3.11 is the exercised runtime. From the repository root:

~~~powershell
backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
$projectTestRoot = Join-Path $env:TEMP ('ecosite-projects-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $projectTestRoot
$env:ECOSITE_DB_PATH = Join-Path $projectTestRoot 'projects.db'
backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini current
backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini check
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-proxy-headers
~~~

Keep the override set in the same terminal for migration and server startup. Do not
point rehearsal commands at the normal database. For a real upgrade, stop writers,
make a SQLite-consistent backup, verify it, rehearse on that copy, inspect the migration,
and obtain approval before deliberately setting the normal path. No normal upgrade
was executed in Phase 02A. Never overwrite or delete the normal database as rollback.

The default remains backend/data/ecosite.db relative to the backend application.
ECOSITE_DB_PATH is expanded and resolved to an absolute path once at process import;
relative overrides still resolve against launch cwd. Both ORM and legacy APIs use
that setting. An absolute override is required for reproducible multi-directory use.
Alembic configuration uses its own file location for script/import paths, so the
same absolute configuration works from the repository or backend directory.
Environment files are not implicitly loaded by Alembic or the app: set process env
explicitly before both commands. No secret or database URL is stored in alembic.ini.

## Sessions and migration ownership

Only projects and alembic_version are added. Legacy facilities schema, indexes and
payloads are never managed, reseeded or rewritten by the migration. Alembic's metadata
filter excludes unmanaged tables from autogeneration; review every generated migration.
The existing app startup still seeds/refreshes facilities as before; migration itself
does not. Project startup never seeds projects and never runs create_all or migrations.

Each request owns a SQLAlchemy session/transaction, commits on successful completion,
rolls back on exceptions and closes all connections. NullPool and disposal avoid
Windows file-handle retention. Connections use foreign_keys=ON and a 5000ms busy timeout;
legacy sqlite3 already uses its default 5-second timeout. No WAL/journal change is made.
Explicit BEGIN makes migration DDL transactional on the exercised Python 3.11 SQLite.
Schema readiness is checked on a separate connection before the request transaction,
so revision writes do not upgrade a pre-existing read transaction under concurrency.
Missing/unsupported migration versions return controlled 503 schema_not_ready from
project routes; SQLite/ORM failures return redacted 503 database_unavailable.

The initial revision is 02a_001. Upgrade is repeatable. Destructive downgrade is
intentionally refused; use reviewed backup restoration for recovery. Migration failure
rollback and retry are tested. Offline --sql migration generation is not supported by
this small online-only environment.

## Project schema and API

Project fields: id (server-generated UUID), name and organization_label (required,
trimmed 1–200 character strings), archetype, stage, revision (starts at 1), status
(active by default or archived), created_at/updated_at (UTC). No owner_id, readiness
claim, legal verification or automatic browser-data import exists.

Archetypes: enterprise, colocation, hyperscale, edge, other.
Stages: concept (default), feasibility, design, construction, operational.
These are MVP workflow labels, not regulatory approvals. Organization is a label.
Database check constraints protect revision, status, stage, archetype and text lengths.

| Method/path under /api/v1 | Contract |
|---|---|
| POST /projects | Required name, organization_label, archetype; optional stage. 201 Project. Unknown/server-owned fields rejected. |
| GET /projects | {items,total,page,page_size}; page>=1, page_size 1–100 (default 50). Archived excluded unless include_archived=true. Stable created_at/id order. |
| GET /projects/{id} | UUID required; 200 including archived records, or 404. |
| PATCH /projects/{id} | expected_revision (positive strict JSON integer) plus one or more non-null editable fields; 200 updated Project. status=active restores an archived project. |
| DELETE /projects/{id}?expected_revision=N | Soft archive only; 200 archived Project. No row deletion. |

PATCH and archive use a single UPDATE WHERE id AND revision, increment revision and
update timestamp atomically. Competing writes with the same revision yield one success
and one 409 revision_conflict. Missing IDs return 404 project_not_found; invalid input
422; remote/disallowed origin 403 local_only. API does not expose raw SQL exceptions.
An archive retry with its old revision yields 409; refetch before retrying. POST is not
idempotent: blind create retries can produce duplicate projects and are not auto-retried.

Example create body:

~~~json
{"name":"India compute pilot","organization_label":"EcoSite","archetype":"colocation","stage":"concept"}
~~~

Example edit body:

~~~json
{"expected_revision":1,"stage":"feasibility"}
~~~

OpenAPI describes these request/response models. No frontend contracts were replaced.

## Validation evidence

Migration rehearsal against an empty database and a disposable SQLite backup of the
normal database: upgrade, repeated upgrade, alembic check and integrity_check passed.
All 6 legacy facility rows plus their schema/index definitions and full row contents
were unchanged on the copy (digest c525ee37831cf7e5aeb44fc1679fb974b7c07350a7a5eefada1aae15ce8229ab).
Normal database SHA-256 remains 669505be79419bd771ff2c2ccae1b1fbfa1b1a8aeaec8996571e157f00a9697a.

New tests cover CRUD/archive/restore/pagination, UUID/timestamps, fresh-process persistence,
validation, absent IDs, stale and concurrent writes, transaction/API rollback, safe
bound strings, redacted failures, local Host/Origin/client rejection, schema readiness,
foreign keys/timeouts, Windows immediate deletion, legacy schema/payload preservation,
transactional DDL failure/retry, idempotent migration/autogeneration, and CLI/path handling.

Run from repository root:

~~~powershell
npm --prefix frontend run lint -- --no-cache
npm --prefix frontend run test
npm --prefix frontend run build
backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
git diff --check
~~~

The Phase 01 checkpoint remains 27eb14e3a67b0b68011c4884f6c62e18b4756df3.
No stage/commit/reset/clean operations are part of Phase 02A. The pre-existing
.vscode/tasks.json and inaccessible .pytest_cache are untouched. Manual print-preview
acceptance remains open from Phase 01; it is not covered by backend database tests.

Final Phase 02A results (2026-10-27): lint PASS; frontend 116/116 PASS; production build PASS (existing >500 kB warning); backend 32/32 PASS (17 original + 15 new); pip check PASS; git diff --check PASS. All commands exited 0. Installation required a process-only valid pip CA bundle override for an inherited nonexistent PostgreSQL certificate path; TLS verification remained enabled. No machine environment or secret file was edited.
