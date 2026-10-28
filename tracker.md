# EcoSite Ministry Platform - Research and Delivery Tracker

Last updated: 2026-10-29

## Current objective

Build a one-day, locally runnable government dashboard prototype covering
publicly disclosed data-centre facilities in Maharashtra, Telangana, Karnataka
and Tamil Nadu. The platform includes a public registry, restricted operator
registration, ministry review and sustainable new-site screening.

Immediate milestone: public operational-facility registry and dashboard.
Operator minimum-submission requirements are deferred until that milestone is
working.

## Research completed

- [x] Reviewed the existing frontend, backend, tests and data architecture.
- [x] Scanned `data/` and `backend/data/` for integrity and provenance issues.
- [x] Researched the NITI Aayog Data Centre Evaluation Framework.
- [x] Researched BEE efficiency guidance and BIS/NBC references.
- [x] Researched MoEFCC environmental clearance, ESZ/ESA and CRZ considerations.
- [x] Researched IMD, CPCB and NRSC Bhuvan public-data services.
- [x] Reviewed official/primary policy sources for the four target states.
- [x] Created the ministry parameter registry and authoritative-source catalogue.
- [x] Defined the proposed platform/API/database architecture.
- [x] Replaced the original 5-6 hour scope with a one-day build plan.
- [x] Completed public facility inventory research pass 1 using operator sources.
- [x] Established lifecycle and capacity-boundary rules for facility ingestion.
- [x] Selected the frontend/backend/SQLite technology stack.
- [x] Defined frontend versus backend responsibilities and API boundaries.
- [x] Defined the proposed structured SQLite data model and file-storage boundary.
- [x] Defined public environmental time-series ingestion and caching architecture.
- [x] Defined 24h/7d/30d/90d/1y dashboard range behaviour.
- [x] Defined monitoring-station context and distance disclosure rules.
- [x] Researched CPCB 15-minute air observations, IMD APIs and NWDP groundwater telemetry.
- [x] Benchmarked EU and US government data-centre reporting and environmental
  monitoring platforms.
- [x] Confirmed that no reviewed public government platform combines a live
  facility registry, resource telemetry, environmental context and siting in
  one system.
- [x] Selected a federated benchmark model: EU-style reporting registry plus
  AirNow/USGS/EEA-style real-time environmental feeds.
- [x] Audited frontend, backend/API and database workstreams for parallel delivery.
- [x] Created exclusive file ownership, contract gates and copy-ready prompts for
  three implementation agents.

## Confirmed product decisions

- [x] Include every physically existing, publicly disclosed facility in the four
  states, regardless of private or government ownership.
- [x] Keep proposed and under-construction facilities in separate lifecycle states.
- [x] Show only currently operational facilities on the public dashboard.
- [x] Exclude proposed, announced and under-construction projects from public totals.
- [x] Require operational-status revalidation every three months (90 days).
- [x] Automatically withhold stale facility records until reviewer reconfirmation.
- [x] Accept any credible, traceable source under a tiered evidence policy.
- [x] Preserve source class; credible reporting is not government verification.
- [x] Skip numeric confidence scoring; retain sources and review status.
- [x] Use built-in demo Operator and Ministry Reviewer roles for the local prototype.
- [x] Defer production SSO, MFA and verified organisation onboarding.
- [x] Use only public information in the initial facility dashboard.
- [x] Provide an operator-registration page with map-based location entry.
- [x] Keep exact operator-submitted geometry restricted.
- [x] Show only generalised locality-level geometry on the public map.
- [x] Keep new registrations private until ministry approval.
- [x] Publish an approved snapshot rather than exposing mutable submissions.
- [x] Never interpret registration as government verification.
- [x] Never automatically approve a proposed site; use “recommended for detailed review.”

## Data/integrity findings to resolve

- [x] Correct the NITI framework PDF hash in `data/documents_manifest.json`.
- [x] Add the UP 2026 guidelines PDF to the document manifest and validate all
  12 manifest files by byte size and SHA-256.
- [x] Reconstruct the missing `03b_001`/`03c_001` lineage and advance the
  reproducible schema head through registration/review revision `04c_001`.
- [x] Create hash-verified backups, migrate the live database to `04c_001` and
  import 19 approved public facility snapshots; integrity and foreign keys pass.
- [x] Audit raw snapshots by uncompressed payload SHA-256: all three database
  rows have exact path/hash matches and require no repair.
- [ ] Decide whether to index or retain 110 currently unlinked raw gzip files
  (30 CGWB, 34 Copernicus and 46 JRC); no files were deleted or moved.
- [ ] Repair project evidence isolation and persistence defects.
- [ ] Restore a green frontend lint baseline in touched feature areas.

## Research artifacts

- `data/research/README.md`
- `data/research/01-ministry-dashboard-parameters.md`
- `data/research/02-authoritative-data-sources.md`
- `data/research/03-platform-architecture.md`
- `data/research/04-five-hour-mvp.md` (superseded time-box; decisions retained)
- `data/research/05-one-day-build-plan.md`
- `data/research/06-public-facility-inventory.md`
- `data/research/07-tech-stack-and-data-ownership.md`
- `data/research/08-public-environmental-timeseries-architecture.md`
- `data/research/09-us-europe-government-platform-benchmarks.md`
- `docs/implementation/parallel-agent-execution-plan.md`

## Open decisions

- [ ] Select India-map opening view or fitted four-state opening view.
- [ ] Complete the second-pass facility inventory and deduplication across all
  major operators in the four states.
- [ ] Confirm continued use of the EcoSite name and dark visual identity.

## Implementation status

Parallel execution plan: Phase 0 assigns migration recovery to the Database
Agent, API-contract freezing to the Backend Agent and typed mock/shell alignment
to the Frontend Agent. Phase 1 integration starts only after the shared contract
gate passes.

Current execution change: frontend implementation is deferred. Database and
Backend/API agents are active under
`docs/implementation/backend-database-delivery-board.md`; frontend resumes after
stable registry and environmental contracts.

- [x] Assigned Database Agent Wave 0: migration recovery and database contract.
- [x] Assigned Backend/API Agent Wave 0: API contract and repository boundaries.
- [x] Pass Wave 0 database/API contract gate.

- [x] Reproducible migration-chain and document-manifest repairs
- [x] Live database hash-verified backup, upgrade and registry import
- [x] Prototype operational-facility seed and first-pass deduplication
- [x] Public registry backend contract and read-only API
- [x] Public registry privacy and verification-window unit tests
- [x] Create isolated Python 3.11 environment and run the complete backend suite
  (179/179 passing).
- [ ] Public facility map, filters and profiles
- [x] Public registry frontend route, state/search filters and provenance table
- [x] Operational summary cards without invalid capacity aggregation
- [x] Public registry frontend service tests (3 passing)
- [x] Touched public-registry frontend files pass ESLint
- [x] Frontend production build passes after registry integration
- [ ] Public facility map and individual facility profile
- [x] Registration/review/publication schema and immutable audit history
- [x] Backend API contracts, persistence integration and tests
- [ ] Public registry dashboard
- [ ] Operator registration interface
- [ ] Ministry review interface
- [x] Cached environmental API integration with honest `NOT_COVERED` responses
- [x] Environmental time-series schema, station links, observations and rollups
- [x] CPCB connector, transactional ingestion store and manual job runner
- [ ] Configure CPCB endpoint/key/field mapping and verify a live provider run
- [ ] Verify IMD and NWDP response/access contracts before enabling their adapters
- [x] Backend end-to-end, migration, privacy, restart and live smoke verification
- [x] SQLite integrity, backup/restore and dry-run retention tooling/runbook

Inventory status: research pass 1 is sufficient for a prototype seed but is not
an exhaustive four-state census. Additional operators and aliases still require
second-pass verification before any claim of completeness.

## Update rule

Whenever research is added or changed:

1. update the relevant file under `data/research/`;
2. record the research result or decision in this tracker; and
3. revise `plan.md` if the result changes scope, priorities or sequencing.
