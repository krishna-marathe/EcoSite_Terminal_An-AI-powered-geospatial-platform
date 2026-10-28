# EcoSite Ministry Platform - Current Plan

Last updated: 2026-10-29

## Vision

Use public and operator-declared data to help government monitor India's
data-centre footprint and plan new facilities without unacceptable harm to
biodiversity, communities, water systems or the electricity grid.

The broader green-city vision remains relevant: data centres are the first
vertical through which the platform will combine urban data, environmental
intelligence, infrastructure planning and accountable public policy.

Visual reference: https://www.worldmonitor.app/dashboard

## One-day prototype outcome

A complete local demonstration containing:

1. a public registry of publicly disclosed facilities across Maharashtra,
   Telangana, Karnataka and Tamil Nadu that are verified as currently operational;
2. a public map using generalised locality-level facility positions;
3. public-source provenance and honest unknown/unavailable fields;
4. private operator registration with exact map location;
5. ministry review, information-request, rejection and approval states;
6. approved immutable public snapshots;
7. environmental context and sustainable new-site screening; and
8. tests and documentation for the end-to-end workflow.

The local prototype uses clearly marked demo Operator and Ministry Reviewer
roles. These demonstrate authorization boundaries but are not production
authentication.

## Current delivery priority

Build the public operational-facility registry first: credible-source records,
90-day verification, generalized locations, public APIs, map, filters and
facility profiles. Defer the final minimum operator-registration form until the
public dashboard is working.

Current execution order: frontend implementation is temporarily paused. The
Database and Backend/API agents run as a two-track pipeline, with the database
one schema wave ahead and integration controlled by contract gates. See
`docs/implementation/backend-database-delivery-board.md`.

Backend/database implementation status: Waves 0-6 are complete for the local
prototype. The live SQLite database is at `04c_001`, contains 19 approved public
facility snapshots, and passes integrity/foreign-key checks. Public registry,
cached environmental, ministry operations and restricted registration/review
APIs are wired. Live environmental ingestion still requires verified provider
access/configuration; missing coverage is returned explicitly rather than filled.

## Selected technology stack

- React 19 + TypeScript + Vite for the frontend
- TanStack Query for server state; Zustand only for temporary UI/preferences
- MapLibre for public and planning maps
- Python 3.11 + FastAPI + Pydantic for the backend/API
- SQLAlchemy + Alembic for structured persistence and migrations
- SQLite for all structured prototype data
- Controlled file storage for large documents/rasters/raw snapshots, with
  hashes and metadata stored in SQLite

FastAPI is the sole structured-data write boundary. The browser never accesses
SQLite or restricted geometry directly.

## Environmental time-series architecture

- Facility identity/capacity/location remain stable registry data.
- Backend connector jobs poll official public AQI, weather and water sources.
- Third-party APIs are never called from the browser or during facility-page requests.
- SQLite stores normalised observations, station links, freshness and rollups.
- Frontend requests 24h, 7d, 30d, 90d or 1y ranges from EcoSite APIs.
- AQI/weather may be hourly or better; groundwater is commonly six-hourly and
  must be labelled as nearby station context rather than an on-site reading.
- Missing/stale/provider-down states remain visible and are never converted to zero.

## International benchmark direction

- Use the European Commission data-centre database as the main precedent for
  mandatory registration, shared metric definitions, annual operator reporting
  and confidential facility-level records with safe public aggregation.
- Use US AirNow, USGS Water Data and EEA services as precedents for federating
  near-real-time station observations with freshness and quality metadata.
- Keep static facility facts, annual operator reports, public environmental
  context and private live telemetry as different temporal/evidence classes.
- Do not wait for or depend on a foreign all-in-one platform: no reviewed public
  government system currently combines the full EcoSite scope.

## Delivery sequence

The full implementation can use three coordinated agents, but the active work
currently uses only the Database and Backend/API agents. Frontend work is
deferred until registry and environmental contracts are stable. The Database
Agent owns models/migrations/imports and the Backend Agent owns
APIs/services/connectors. Each phase uses a database contract -> API contract
gate. See
`docs/implementation/parallel-agent-execution-plan.md` for exact ownership,
phase dependencies and copy-ready prompts.

### Phase 0 - parallel contract and recovery sprint

- Database Agent: repair/reconstruct the missing `03b_001`/`03c_001` lineage,
  add missing ORM coverage and prove a fresh database reaches one head.
- Backend Agent: freeze public registry, environmental and workflow response
  examples behind repository interfaces; do not add tables.
- Frontend Agent: deferred until registry and environmental API contracts are stable.
- Gate: migration, database vocabulary and API examples agree.

### Phase 1 - Stabilise foundations

- Correct the document manifest. (Complete: 12/12 files have validated sizes and hashes.)
- Resolve the database/migration revision mismatch. (Complete: source and live
  database are at `04c_001`; pre-migration hash-verified backups are retained.)
- Retain the 110 unlinked raw gzip snapshots until a reviewed retention/indexing
  decision; the three database snapshot rows already have exact path and
  uncompressed-payload-hash matches, so no path repair is required.
- Confirm the supported Python test environment. (Complete: isolated
  `backend/.venv311`; full backend suite passes.)
- Define exact public versus restricted data contracts.
- Define metric temporal classes and the public/ministry/regulator visibility matrix.
- Define facility identity, alias, lifecycle and typed-capacity contracts so
  campus totals are not confused with operational IT load.

### Phase 2 - Backend workflow

- Implement the normalized public registry schema/API. (Complete.)
- Deterministically import the reviewed file seed into SQLite. (Complete: 19.)
- Add monitoring stations, environmental observations and rollups. (Complete.)
- Add operator registration, immutable revisions and evidence metadata. (Complete.)
- Add ministry review, audit events and approved snapshots. (Complete.)
- Physically separate restricted exact and generalized public geometry. (Complete.)
- Add public registry, environmental, operator and ministry endpoints. (Complete.)
- Test state transitions and restricted-field privacy. (Complete.)

### Phase 3 - Public dashboard

- Build four-state overview and summary metrics.
- Public registry list, summary and filters are implemented; map and detail profile remain.
- Add facility map, filters and registry table.
- Add facility profiles with field-level provenance.
- Exclude proposed, announced and under-construction facilities from public views.
- Show unknown values instead of estimates.
- Seed only credible-source-supported public facilities; keep government,
  operator, filing, certification, media and directory evidence distinct.
- Enforce a 90-day operational-verification expiry; stale records are withheld
  from public APIs until reviewed again.

### Phase 4 - Registration and review interfaces

- Build operator registration wizard and map picker.
- Build private submission/status view.
- Build ministry queue and evidence review.
- Publish approved snapshots with generalised geometry.

### Phase 5 - Sustainable site planning

- Reuse candidate-project and polygon functionality.
- Present hard constraints before comparative scores.
- Show water, power, biodiversity, people, hazard and connectivity dimensions.
- Produce a provenance-aware site passport.

### Phase 6 - Verification

- Run backend API tests.
- Run frontend tests and lint for touched areas.
- Build the production frontend.
- Smoke-test operator submission through public publication.
- Document real, derived, declared, synthetic and unavailable data.
- Run backend tests under the documented Python 3.11 baseline; do not treat the
  current Python 3.15/Pydantic import failure as an application test result.

Current verification: the isolated Python 3.11 environment passes the complete
backend suite (179/179). The live database reports revision `04c_001`,
`PRAGMA integrity_check=ok`, no foreign-key violations and no Alembic drift.
Frontend public-registry service tests and production build passed before the
backend response was intentionally changed to a paginated envelope; frontend
integration remains the next phase and must update that client contract.

## Architectural guardrails

- Public facts, operator declarations and government verification remain distinct.
- Credible secondary reporting may support publication after review, but never
  inherits government-verification status.
- Do not calculate or display a numeric confidence score; show provenance and
  review state instead.
- Exact facility geometry is restricted; public geometry is stored separately.
- Submissions are private until reviewed.
- Public data comes from an approved snapshot, never directly from a submission.
- Infrastructure proximity is not capacity.
- Screening is not legal clearance.
- Missing operational data is not synthetically filled in the public registry.
- Operational publication requires revalidation at least once every 90 days.
- Sensitive network, customer, resilience and cybersecurity details are never public.

## Deferred beyond the prototype

- Production government SSO and verified operator onboarding
- Live private telemetry and utility integrations
- National rollout beyond the four states
- Security accreditation and public production hosting
- Legally authoritative automated approvals
- AI models trained on real historical operator data

## Research synchronization

Every research update must modify:

- the appropriate document under `data/research/`;
- `tracker.md` with findings, decisions and status; and
- this plan whenever scope, architecture, priorities or delivery order changes.
