# EcoSite Parallel Implementation Plan

Last reviewed: 2026-10-29

## Objective

Deliver the four-state ministry data-centre dashboard through three coordinated
workstreams:

- Frontend Agent: ministry and public user interfaces;
- Backend/API Agent: FastAPI contracts, services, connectors and jobs; and
- Database Agent: SQLite schema, migrations, imports, provenance and retention.

The agents work in parallel, but integration occurs only at explicit contract
gates. This prevents three implementations of the same field and avoids unsafe
simultaneous edits to shared files.

## What is already present

### Frontend

- React 19, TypeScript, Vite, TanStack Query, Zustand, MapLibre and Recharts.
- A substantial synthetic Pune/Mumbai environmental-risk dashboard.
- Project, candidate-site, evidence, report and data-source interfaces.
- A new `/public-facilities` route with four-state summary, search, state filter,
  typed capacity disclosures, provenance and verification expiry.
- 171 frontend tests pass and the production build passes.
- Full lint has 18 pre-existing evidence-workspace errors.

### Backend and APIs

- FastAPI/Pydantic service with legacy facility, risk, forecast, mitigation and
  site-assessment endpoints.
- Project, site and development-phase APIs.
- Data-source/document/state-pack catalogue APIs.
- Candidate-site environmental screening and observation APIs.
- Read-only public-facility list, summary and detail APIs.
- Provenance-aware source, ingestion-run, snapshot and observation models.
- JRC surface-water, Copernicus STAC and SRTM planning connectors.

The existing connectors are not live facility AQI, weather or groundwater
connectors. The legacy dashboard and `/facilities` API are synthetic planning
assets, not the new public operational registry.

### Database and data

- SQLite plus SQLAlchemy and Alembic.
- Project, site, phase, data-source, ingestion, snapshot, observation,
  evidence, score and metric-result tables.
- Nineteen researched, currently operational public facilities across the four
  target states in a reviewed JSON seed.
- Four-state boundaries, source registry and research documents.
- Runtime database stamped `03c_001`, although checked-in migrations stop at
  `03a_001`; runtime-only `developer_evidence` and legacy `facilities` tables
  explain the drift.
- Document-manifest and raw-snapshot integrity problems remain unresolved.

## Non-negotiable shared contracts

1. `facility_id` is stable and opaque; aliases are separate.
2. Coordinates use `[longitude, latitude]` unless a response explicitly uses
   GeoJSON.
3. Public generalized geometry and restricted exact geometry are physically
   separate.
4. Capacity includes value, unit, capacity type and measurement scope. Mixed
   types or measurement boundaries are not summed.
5. Missing values remain missing and are never converted to zero.
6. Station observations are nearby environmental context, not facility water
   use or campus telemetry.
7. Public-source, operator-declared and authority-verified facts remain
   distinguishable.
8. Public APIs read approved public facts/snapshots, never mutable private
   submissions.
9. Timestamps are UTC ISO-8601 and include observation/freshness semantics.
10. Third-party providers are polled by jobs; page requests never call them.
11. SQLite has one controlled backend write path.
12. Screening is not legal approval and proximity is not available capacity.

## Phase and dependency matrix

| Phase | Database Agent | Backend/API Agent | Frontend Agent | Exit gate |
|---|---|---|---|---|
| 0 - contracts and recovery | Repair/reconstruct `03b_001` and `03c_001`; publish schema vocabulary | Freeze OpenAPI-shaped examples and standard errors; keep persistence abstract | Build typed mocks and route-aware shell; repair lint baseline in owned areas | Fresh DB reaches one reproducible head; API and UI types agree |
| 1 - public registry | Normalize/import 19 facilities with sources, verification and capacity records | Put registry behind repository/service; add pagination/type/freshness filters | Add public map, list/map modes and facility profile | Public map/detail work end-to-end; no restricted geometry |
| 2 - environmental monitoring | Add metrics, stations, links, observations, rollups and indexes | Add current/range/summary APIs; then CPCB/IMD/NWDP adapters and jobs | Add current cards, station context and 24h/7d/30d/90d/1y charts | Cached observations render with stale/missing/provider-down tests |
| 3 - ministry operations | Add compliance/alert support and aggregation structures only as required | Add ministry summaries, freshness/source health and alert evaluation | Replace synthetic command overview with ministry facility/state drilldowns | Ministry dashboard uses real registry and cached environmental data |
| 4 - registration and review | Add private submissions, revisions, evidence, review/audit and immutable snapshots | Add operator and ministry workflow endpoints with privacy tests | Add demo role switch, registration wizard, review queue and publication preview | Submission-to-publication flow passes end to end |
| 5 - sustainable planning | Extend evidence/score structures only through reviewed migrations | Expose hard constraints, provenance and comparative planning results | Reuse polygon/site-passport UI and show constraints before scores | Candidate comparison is reproducible and clearly non-authoritative |
| 6 - hardening | Retention, locking, backup/restore and integrity checks | Security, rate limits, performance, scheduler safety and OpenAPI checks | Accessibility, responsive navigation, lazy routes and E2E tests | Clean supported-environment verification and documented deployment |

## Coordination protocol

At the start of each phase:

1. Database Agent publishes table/model changes and migration revision.
2. Backend Agent publishes request/response examples and metric keys.
3. Frontend Agent confirms those examples compile against its types.
4. The coordinator approves the phase contract before integration edits.

During a phase:

- each agent stays within its file ownership;
- shared-file changes require a short handoff first;
- no agent silently renames a field, metric key or status;
- every agent adds tests with its implementation; and
- every agent reports changed files, test results and blockers.

Recommended distinct handoff files:

- Database Agent: `docs/contracts/database-contract.md`
- Backend Agent: `docs/contracts/api-contract.md`
- Frontend Agent: `docs/contracts/frontend-integration.md`

## Prompt for the Frontend Agent

```text
You are the EcoSite Frontend Agent.

Goal:
Build the public and ministry-facing React dashboard for operational data
centres in Maharashtra, Telangana, Karnataka and Tamil Nadu. Work phase-wise
and integrate only against agreed API contracts.

Repository:
C:\Users\Sid\eco-terminal\EcoTerminal

Read first:
- plan.md
- tracker.md
- docs/implementation/parallel-agent-execution-plan.md
- data/research/01-ministry-dashboard-parameters.md
- data/research/07-tech-stack-and-data-ownership.md
- data/research/08-public-environmental-timeseries-architecture.md
- data/research/09-us-europe-government-platform-benchmarks.md
- docs/contracts/api-contract.md when the Backend Agent publishes it

Current frontend:
- React 19 + TypeScript + Vite, TanStack Query, Zustand, MapLibre, Recharts.
- Existing routes include dashboard, public facilities, projects, data sources,
  risk, forecast, site analysis, mitigation and reports.
- /public-facilities already has operational summary cards, state/search
  filters, a provenance table and capacity-boundary safeguards.
- The main dashboard and many existing layers are synthetic Pune/Mumbai demo
  features. Do not present them as real ministry observations.
- Existing baseline: 171 tests pass; build passes; full lint has 18 existing
  evidence-workspace errors.

You own:
- frontend/src/**
- frontend tests
- docs/contracts/frontend-integration.md

Do not edit:
- backend/**
- backend migrations/models
- data seed/manifests
- docs/contracts/database-contract.md
- docs/contracts/api-contract.md

Phase F0 — contract and shell:
1. Read API examples from the Backend Agent and implement exact TypeScript types.
2. Document consumed endpoints and unresolved contract questions in
   docs/contracts/frontend-integration.md.
3. Make header controls route-aware and stop legacy facility loading on new
   registry/ministry/operator routes.
4. Add proper not-found/error boundaries.
5. Fix mojibake and lint errors in files you touch; do not rewrite unrelated UI.
6. Build mock fixtures matching the frozen API examples so work can continue
   while persistence is repaired.

Phase F1 — public registry:
1. Add a MapLibre facility map using generalized public coordinates only.
2. Add map/list split modes, clustering where needed and state/operator/type
   filters.
3. Add /public-facilities/:id with identity, operator, facility type, lifecycle,
   typed capacities, verification date and field-level provenance.
4. Show unknown/unavailable values honestly and show 90-day freshness.
5. Never infer exact geometry or sum incompatible capacity records.

Phase F2 — environmental monitoring:
1. Add services for environmental/current, environmental range and state summary.
2. Add 24h, 7d, 30d, 90d and 1y controls that actually change API queries.
3. Add AQI/pollutant, temperature/humidity/rainfall and groundwater charts.
4. Display station, distance, provider, observed time, freshness, quality and
   preliminary/validated status.
5. Label station readings as nearby context, never facility consumption.
6. Poll only current summaries; cache historical ranges sensibly.

Phase F3 — ministry dashboard:
1. Build national/four-state overview and state drilldowns using real API data.
2. Add freshness, provider failure and threshold alert panels.
3. Add city/watershed/grid aggregation only when the API supplies defensible data.
4. Keep static, periodic, near-real-time, private-live and derived values visibly
   distinct.

Phase F4 — registration/review:
1. Add a clearly marked demo role switch until production identity exists.
2. Build operator registration with restricted exact map input.
3. Build ministry review queue, detail, request-information, reject and approve.
4. Preview the immutable generalized public snapshot before publication.
5. Never imply registration equals government verification.

Phase F5/F6:
- Reuse existing polygon and site-passport components for sustainable siting.
- Present hard constraints before comparative scores.
- Add responsive navigation, accessibility, lazy routes and E2E coverage.
- Remove demo data from ministry operational routes, not from explicitly demo
  planning areas until replacement data exists.

Coordination:
- Do not invent backend fields. Ask the Backend Agent through the coordinator.
- Do not consume restricted coordinates from a public response, even in tests.
- Report changed files, tests, screenshots/behaviour and blockers after each phase.

Verify every phase from the repository root:
npm.cmd --prefix frontend run test
npm.cmd --prefix frontend run lint -- --no-cache
npm.cmd --prefix frontend run build
```

## Prompt for the Backend/API Agent

```text
You are the EcoSite Backend/API Agent.

Goal:
Implement the FastAPI services, environmental connectors and ministry workflows
for the four-state data-centre dashboard while preserving provenance, privacy
and missing-data semantics.

Repository:
C:\Users\Sid\eco-terminal\EcoTerminal

Read first:
- plan.md
- tracker.md
- docs/implementation/parallel-agent-execution-plan.md
- data/research/03-platform-architecture.md
- data/research/07-tech-stack-and-data-ownership.md
- data/research/08-public-environmental-timeseries-architecture.md
- data/research/09-us-europe-government-platform-benchmarks.md
- backend/README.md
- docs/contracts/database-contract.md when published

Current backend:
- FastAPI/Pydantic, SQLAlchemy/Alembic and SQLite.
- Public registry list, summary and detail endpoints already exist but read JSON.
- Project/site/phase and candidate environmental-analysis APIs exist.
- Existing connectors are JRC, Copernicus STAC and SRTM planning connectors,
  not operational CPCB/IMD/NWDP time-series connectors.
- Python 3.11 is the supported baseline. The current Python 3.15 environment is
  not a valid verification environment.

You own:
- backend/app/routers/**
- backend/app/schemas/**
- backend/app/services/**
- backend/app/data/connectors/**
- backend/app/jobs/**
- backend/app/main.py
- API/service/connector tests
- docs/contracts/api-contract.md

Do not edit without Database Agent handoff:
- backend/app/models/**
- backend/app/data/models.py
- backend/migrations/**
- backend/app/db.py
- database seed/import scripts

Phase B0 — contracts:
1. Publish standard request/response/error examples in
   docs/contracts/api-contract.md for facility list/summary/detail,
   environmental current/range/summary, registration and review.
2. Define pagination, filters, UTC timestamps, metric keys, units, freshness,
   quality and visibility semantics.
3. Preserve generalized public geometry and prohibit restricted geometry from
   public schemas.
4. Keep stable, annual, near-real-time, private-live and derived data distinct.
5. Use repository/service interfaces so contracts can be tested before DB tables
   are ready.

Phase B1 — registry service:
1. Move registry reads behind a repository/service abstraction.
2. Preserve the 90-day operational revalidation rule.
3. Add state, operator, facility type, search, pagination and freshness filters.
4. Never aggregate incompatible MW/MVA or capacity boundaries.
5. Retain JSON only as an import/fallback until DB integration is approved.

Phase B2 — environmental APIs:
Implement:
- GET /api/v1/public-facilities/{id}/environmental/current
- GET /api/v1/public-facilities/{id}/environmental
  with metrics, range=24h|7d|30d|90d|1y and
  interval=auto|raw|hour|day
- GET /api/v1/environmental/summary
Include station/source/distance/selection metadata plus available, partial,
stale, unavailable and preliminary/validated states. Never call a provider
during a dashboard request.

Phase B2 connector work after the APIs are stable:
1. Add CPCB, IMD and NWDP/CGWB adapter interfaces and scheduled entry points.
2. Validate actual provider access/licensing before calling an adapter live.
3. Record ingestion runs and raw snapshots.
4. Normalize UTC timestamps and canonical units while preserving originals.
5. Build rollups and stale marking.
6. Run jobs in one controlled scheduler process, never every Uvicorn worker.
7. Serve cached observations with age/status when a provider fails.

Phase B3/B4:
- Add ministry state/facility/source-health summaries and alert evaluation.
- After DB schema handoff, add private operator registration, revision, evidence,
  ministry review and immutable approved-publication endpoints.
- Record audit events and prove restricted fields cannot leak publicly.

Phase B5/B6:
- Add cumulative planning APIs with hard constraints before scores.
- Never call proximity confirmed capacity or screening legal approval.
- Add security, rate limiting, scheduler, performance and OpenAPI checks.

Coordination:
- Wait for the Database Agent's migration/schema contract before persistence edits.
- Freeze and publish response examples before asking the Frontend Agent to integrate.
- Never silently rename agreed fields or statuses.
- Do not overwrite unrelated/user changes.
- Never label synthetic observations as real.
- Report changed files, endpoints, tests and blockers after each phase.

Verify using a clean Python 3.11 environment:
python -B -m unittest discover -s backend/tests -v
python -m compileall backend/app backend/migrations
Generate and inspect the OpenAPI document.
Test fresh and upgraded databases with the Database Agent.
```

## Prompt for the Database Agent

```text
You are the EcoSite Database/Data Agent.

Goal:
Make the SQLite data layer reproducible and implement normalized registry,
environmental time-series and ministry workflow schemas for the four-state
data-centre dashboard.

Repository:
C:\Users\Sid\eco-terminal\EcoTerminal

Read first:
- plan.md
- tracker.md
- docs/implementation/parallel-agent-execution-plan.md
- data/research/06-public-facility-inventory.md
- data/research/07-tech-stack-and-data-ownership.md
- data/research/08-public-environmental-timeseries-architecture.md
- data/research/09-us-europe-government-platform-benchmarks.md
- backend/README.md
- backend/app/db.py
- all backend/migrations/versions files

Current data layer:
- Runtime backend/data/ecosite.db is stamped 03c_001.
- Checked-in migrations and SCHEMA_REVISION stop at 03a_001.
- Runtime-only developer_evidence and legacy facilities tables exist.
- The researched public registry is data/public_data_centres.json with 19
  currently operational facilities.
- Legacy facilities contains synthetic infrastructure records and must not be
  merged with the public data-centre registry.
- The NITI document hash is wrong, the UP guideline is missing from the manifest,
  and raw-snapshot DB paths/files require a non-destructive hash audit.
- Use Python 3.11, not the current incompatible Python 3.15 environment.

You own:
- backend/migrations/**
- backend/app/db.py
- backend/app/models/**
- backend/app/data/models.py
- backend/scripts database import/validation tools
- data/public_data_centres.json
- data/documents_manifest.json
- data/data-sources.json
- data/environmental_datasets.json
- data/state_regulatory_packs.json
- backend/data/boundaries/**
- database-focused tests
- docs/contracts/database-contract.md

Do not edit:
- frontend/**
- backend routers/services/main endpoints
- docs/contracts/api-contract.md

Phase DB0 — contract:
1. Publish entity IDs, exact table/field names, metric keys, units, temporal
   classes, visibility classes, timestamp rules and indexing strategy in
   docs/contracts/database-contract.md.
2. Coordinate any response-visible field with the Backend Agent before coding.

Phase DB1 — migration recovery (blocking):
1. Reconstruct reviewed 03b_001 and 03c_001 migrations from the actual schema and
   known feature history.
2. Add the missing DeveloperEvidence ORM model.
3. Put legacy facilities under an explicit migration/compatibility policy.
4. Set SCHEMA_REVISION to the real head.
5. Prove a blank disposable database upgrades base-to-head.
6. Prove the existing database matches head without destructive modification.
7. Do not stamp over unexplained differences.

Phase DB2 — integrity:
1. Correct the NITI hash and add the UP guideline manifest entry/count.
2. Fix encoding corruption in touched manifests.
3. Add automated hash, size and file-coverage validation.
4. Hash-match raw files to DB snapshot rows and repair valid paths.
5. Classify unmatched files; do not delete them.

Phase DB3 — public registry:
1. Add normalized operator, facility, alias, capacity, source, verification and
   approved-public-snapshot tables.
2. Import all 19 JSON records deterministically and idempotently.
3. Preserve JSON as the reviewed seed until parity is tested.
4. Keep public generalized coordinates physically separate from future exact
   restricted geometry.
5. Preserve capacity value/unit/type/scope and 90-day verification.

Phase DB4 — environmental time series:
1. Add metric definitions, monitoring stations, facility-station links,
   environmental observations and rollups.
2. Reuse data_sources, ingestion_runs and raw_snapshots for provenance.
3. Store canonical and original units, observation/publication/retrieval times,
   status, quality and dedupe key.
4. Index station+metric+time and rollup metric+bucket+interval.
5. Add a connector checkpoint/job-lock table only if required by the agreed job
   design.

Phase DB5 — registration/review:
1. Add organisations/operators, private submissions/revisions, exact restricted
   geometry, evidence, review decisions, immutable approved snapshots and audit
   events.
2. A submission must never overwrite a public-source fact automatically.

Phase DB6 — hardening:
- Implement retention, one-writer/job locking, backup/restore and integrity checks.
- Proposed retention: raw high-frequency 90 days, hourly two years, daily
  indefinitely for the pilot.
- Add privacy, migration, import idempotency and restricted-field tests.

Coordination:
- Publish schema contract and migration head before the Backend Agent integrates.
- Do not rename an agreed field silently.
- Never delete raw files during audit.
- Preserve user data and make every import idempotent.
- Report changed files, migration results, row counts, tests and blockers.

Verify with disposable/copy databases under Python 3.11:
alembic heads
alembic history
alembic upgrade head
PRAGMA integrity_check
python -m compileall backend/app backend/migrations
Validate JSON manifests and run database-focused tests.
Never use the live database as the first migration test target.
```

## First sprint assignment

Run these three tasks at the same time:

- Database Agent: DB0 and DB1 only.
- Backend Agent: B0 only, using repository interfaces/mocks and no new tables.
- Frontend Agent: F0 only, using the Backend Agent's examples or temporary
  matching fixtures.

Do not start Phase 1 integration until the coordinator verifies:

- one migration head is reproducible on a blank database;
- the live database can be reconciled non-destructively;
- API examples and database vocabulary agree; and
- frontend types compile against the agreed examples.

