# EcoSite Ministry Platform - Current Plan

Last updated: 2026-10-29

## Vision

Use public and operator-declared data to help government monitor India's
data-centre footprint and plan new facilities without unacceptable harm to
biodiversity, communities, water systems or the electricity grid.

The product scope is exclusively data centres. Power, water, air quality,
weather, biodiversity, hazards and grid information are supporting context for
data-centre monitoring and siting; they are not separate plant or resource
registries.

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

Data collection and provenance are the active priority. Complete the second-pass
operating-facility census, freeze an auditable source contract for every public
connector, catalogue stations/layers before observations, and enable only feeds
whose access, licence, schema and freshness rules have been verified. The
dashboard and minimum operator-registration gate are complete enough to consume
this work. Missing live coverage remains `NOT_COVERED`; it is never filled with
synthetic values.

Backend/database implementation used a two-track pipeline, with the database
one schema wave ahead and integration controlled by contract gates. See
`docs/implementation/backend-database-delivery-board.md`. The frontend pause
has ended: registry, environmental, ministry and restricted
workflow contracts are integrated into routed React screens. The current local
prototype passes the full frontend test, lint and production-build gates.

Backend/database implementation status: Waves 0-6 are complete for the local
prototype. The live SQLite database is at `04c_001`, contains 19 approved public
facility snapshots, and passes integrity/foreign-key checks. Public registry,
cached environmental, ministry operations and restricted registration/review
APIs are wired. Live environmental ingestion still requires verified provider
access/configuration; missing coverage is returned explicitly rather than filled.
Implementation-ready source contracts and collection order are recorded in
`data/research/10-authoritative-collection-contracts.md`. CPCB through the OGD
API and NWDP station/resource catalogues are the first public connector targets;
IMD requires account/terms/quota verification before scheduled polling.

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
- Treat those 19 records as a prototype seed, not a complete census. Research
  pass 2 identified 25 strong missing facility-level candidates plus unresolved
  operator footprints; see
  `data/research/10-public-facility-inventory-gap-audit.md`.
- Stage discoveries in a private candidate queue before public import. Capture
  aliases, lifecycle wording, capacity type/boundary, retrieval timestamp and
  source content hash; never write web discoveries directly to approved public
  snapshots.
- Review candidates in operator batches, resolving conflicting Sify/Yotta
  capacity disclosures and separating live phase, building, campus-design and
  combined-facility values.
- Add monitoring stations, environmental observations and rollups. (Complete.)
- Add operator registration, immutable revisions and evidence metadata. (Complete.)
- Add ministry review, audit events and approved snapshots. (Complete.)
- Physically separate restricted exact and generalized public geometry. (Complete.)
- Add public registry, environmental, operator and ministry endpoints. (Complete.)
- Test state transitions and restricted-field privacy. (Complete.)

### Phase 3 - Public dashboard

- Build four-state overview and summary metrics. (Complete for registry/ministry views.)
- Public registry list, summary, filters, map and detail profile are implemented.
- Add facility map, filters and registry table. (Complete.)
- Add facility profiles with field-level provenance. (Complete.)
- Exclude proposed, announced and under-construction facilities from public views.
- Show unknown values instead of estimates.
- Seed only credible-source-supported public facilities; keep government,
  operator, filing, certification, media and directory evidence distinct.
- Keep the dashboard labelled as a prototype inventory until the pass-2 queue
  is reviewed, deduplicated and published through the ministry gate.
- Enforce a 90-day operational-verification expiry; stale records are withheld
  from public APIs until reviewed again.

### Phase 4 - Registration and review interfaces

- Build operator registration and restricted exact-location interface. (Complete.)
- Build private submission/status view. (Complete.)
- Build ministry queue and restricted review detail/actions. (Complete.)
- Preview and publish approved snapshots with generalised geometry. (Complete.)

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
backend suite (184/184). The live database reports revision `04c_001`,
`PRAGMA integrity_check=ok`, no foreign-key violations and no Alembic drift.
The frontend suite passes 220/220 tests, full ESLint passes and the production
build succeeds. Vite still reports a non-blocking large-bundle warning; route
code splitting remains a performance-hardening opportunity.

Runtime smoke verification also passes with FastAPI and Vite running together:
the live registry returns 19 facilities, ministry overview returns 19,
environmental requests return explicit `NOT_COVERED` values where no station is
linked, and all public/ministry/operator routes serve the application shell.

The primary `/dashboard` remains the restored full-bleed command map. It is
constrained to data centres, loads approved public-registry markers, omits the
Pune/Mumbai comparison strip and opens a source-backed facility dossier before
linking to the public profile. Split and grid modes now use real registry,
environmental-coverage and ministry-operations API panels instead of synthetic
telemetry, signal and hotspot panels. External AQI, water, climate,
biodiversity and grid layers remain clearly labelled contextual evidence.
Dashboard integration tests cover grid, split and map modes, real facility
selection, dossier rendering and partial environmental-source failure. Global
government/public workflows now show only the data-centre registry legend, and
candidate site analysis is hard-locked to the data-centre facility type.
`/projects` is now the primary candidate-planning route, with state selection
restricted to Maharashtra, Telangana, Karnataka and Tamil Nadu; the legacy
`/site-analysis` route redirects there.
Operator registration now supports a restricted map point, typed capacity
disclosures and traceable evidence. Incomplete drafts remain saveable, but the
backend blocks ministry submission until the minimum disclosure is complete.
Ministry publication previews use only submitted evidence and never fabricate
an operating year or source metadata.

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
- Do not expose thermal plants, renewable plants, substations or other industrial
  assets as first-class monitored facilities; include external infrastructure
  only as contextual evidence for a data centre or candidate site.

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
