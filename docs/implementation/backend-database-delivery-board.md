# Backend and Database Delivery Board

Last updated: 2026-10-29

## Current delivery decision

Frontend implementation is deferred. The active implementation team contains:

- Database Agent: schema, migrations, normalized data, imports and retention;
- Backend/API Agent: contracts, repositories, services, endpoints, connectors
  and scheduled jobs; and
- Coordinator: contract gates, conflict prevention, integration verification and
  updates to `plan.md` and `tracker.md`.

The Database Agent stays one schema wave ahead of the Backend/API Agent. The API
agent can develop contracts and services against repositories while a schema is
being prepared, but it cannot integrate a table until the database handoff gate
passes.

## Ownership boundary

### Database Agent owns

- `backend/migrations/**`
- `backend/app/db.py`
- `backend/app/models/**`
- `backend/app/data/models.py`
- database import/validation scripts
- database-focused tests
- data manifests and reviewed facility seed
- `docs/contracts/database-contract.md`

### Backend/API Agent owns

- `backend/app/routers/**`
- `backend/app/schemas/**`
- `backend/app/services/**`
- `backend/app/data/connectors/**`
- `backend/app/jobs/**`
- `backend/app/main.py`
- API/service/connector tests
- `docs/contracts/api-contract.md`

Neither agent edits the other agent's owned files without a coordinator handoff.

## Delivery pipeline

| Wave | Database Agent | Backend/API Agent | Gate and deliverable |
|---|---|---|---|
| 0 - recover and contract | Repair `03b_001`/`03c_001`, ORM coverage and reproducible head; publish DB vocabulary | Freeze public, environmental and workflow API examples behind repository boundaries | Fresh DB upgrades to one head; existing DB matches non-destructively; contracts agree |
| 1 - public registry | Add normalized operators, facilities, aliases, capacities, sources and verification; idempotently import 19 records | Implement DB repository/service, filters, pagination, detail and summary while preserving public privacy and 90-day expiry | JSON-to-DB parity; public API tests pass; no restricted geometry exists in responses |
| 2 - environmental core | Add metrics, stations, facility links, observations, rollups, dedupe and indexes | Implement facility current/range and state summary APIs with freshness and station metadata | Deterministic seeded observations return correct 24h/7d/30d/90d/1y responses |
| 3 - ingestion jobs | Add job locks/checkpoints only if contract requires them; finish snapshot-path integrity work | Add CPCB, IMD and NWDP/CGWB adapters, ingestion runs, raw snapshots, rollups and stale marking | Provider failures serve cached data; no request-time third-party calls; one scheduler writer |
| 4 - ministry operations | Add only reviewed alert/compliance aggregation structures | Add source health, stale facility queue, alert evaluation and state/city summaries | Alerts retain source/time/quality; no automatic enforcement action |
| 5 - registration/review | Add private submissions, revisions, evidence, exact geometry, review/audit and immutable public snapshots | Add operator submission and ministry review/publication endpoints with privacy tests | End-to-end state transitions pass; publication cannot leak restricted fields |
| 6 - planning/hardening | Retention, backup/restore, integrity and migration performance | Planning APIs, authentication boundary, rate limits, scheduler and OpenAPI hardening | Clean Python 3.11 suite; fresh/upgrade DB tests; documented operational runbook |

## Wave rules

1. A wave starts with a written schema and API delta.
2. Database migrations are tested first on a blank disposable database and then
   on a copied existing database.
3. The API agent does not stamp, patch or create tables at application startup.
4. The database agent does not implement HTTP response schemas or routers.
5. Every wave includes tests and idempotency or replay behaviour where relevant.
6. Public, declared, verified, derived and synthetic values remain distinct.
7. Missing values remain null/unavailable and never become zero.
8. A connector is not called live until access, licence, cadence and fallback
   behaviour are documented.

## Coordinator gates

At the end of each wave, verify:

- migration head and upgrade path;
- database/API field-name alignment;
- privacy and visibility boundary;
- seed/import row counts and idempotency;
- endpoint contract and error behaviour;
- provenance, timestamps, unit and quality status;
- supported Python 3.11 test output; and
- no edits outside assigned ownership.

## Active assignments

### Database Agent - Wave 0

- Publish `docs/contracts/database-contract.md`.
- Reconstruct reviewed `03b_001` and `03c_001` migrations.
- Add missing `DeveloperEvidence` ORM coverage.
- Establish an explicit legacy `facilities` compatibility policy.
- Set the correct application schema revision.
- Test blank and copied databases without modifying the live database.

### Backend/API Agent - Wave 0

- Publish `docs/contracts/api-contract.md`.
- Freeze list, summary, detail, environmental and workflow examples.
- Define pagination, filters, errors, timestamps, metric keys, units, freshness
  and visibility.
- Use repository abstractions; do not add or integrate new tables.
- Reconcile response-visible vocabulary with the database contract.

## Deferred work

The Frontend Agent does not start until at least Wave 2 APIs have stable examples
and tests. At that point, frontend work can consume public registry and
environmental monitoring contracts without repeated rewrites.

