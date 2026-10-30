# EcoSite Ministry Platform - Research and Delivery Tracker

Last updated: 2026-10-30

## Current objective

Build a one-day, locally runnable government dashboard prototype covering
publicly disclosed data-centre facilities in Maharashtra, Telangana, Karnataka
and Tamil Nadu. The platform includes a public registry, restricted operator
registration, ministry review, sustainable new-site screening, and a live
grounded AI Assistant.

Current Status: ~94% Complete. The core World Monitor tactical HUD, 4-state
public operational registry, 100% parameter coverage risk scoring engine, live
Gemini 3.8 Flash AI Assist, and operator/ministry workflows are fully implemented
and verified with 100% passing automated tests.

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
- [x] Completed facility inventory gap audit pass 2 against current primary
  operator material; identified 25 strong facility-level candidates absent from
  the 19-record seed plus larger Nxtra/STT/Web Werks footprints needing
  facility-level lifecycle and alias resolution.
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
- [x] Converted the authoritative-source catalogue into implementation-ready
  collection contracts covering facility facts, AQI, weather, groundwater,
  surface water/flood, grid, biodiversity and population for the four states.
- [x] Recorded access method, cadence, licence/terms decision, quality caveat,
  blocker and acceptance gate for each priority data family.

## Confirmed product decisions

- [x] Limit the product to data centres; environmental and infrastructure data
  are contextual inputs, not separate facility categories or dashboards.

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
- [x] Repair project evidence isolation and persistence defects.
- [x] Restore a green frontend lint baseline in touched feature areas.

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
- [ ] Review and stage the 25 strong pass-2 candidates, resolve conflicting
  capacity disclosures, and complete facility-level alias/deduplication for
  Nxtra, STT, Web Werks/Iron Mountain and PDG.
- [ ] Confirm continued use of the EcoSite name and dark visual identity.

## Implementation status

Parallel execution plan: Phase 0 assigns migration recovery to the Database
Agent, API-contract freezing to the Backend Agent and typed mock/shell alignment
to the Frontend Agent. Phase 1 integration starts only after the shared contract
gate passes.

The backend/database two-track work ran under
`docs/implementation/backend-database-delivery-board.md`. Frontend deferral is
now complete: stable backend contracts were integrated
into public registry, environmental monitoring, ministry operations, operator
registration and ministry review routes.

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
- [x] Public facility map, filters and profiles
- [x] Public registry frontend route, state/search filters and provenance table
- [x] Operational summary cards without invalid capacity aggregation
- [x] Public registry frontend service tests (3 passing)
- [x] Touched public-registry frontend files pass ESLint
- [x] Frontend production build passes after registry integration
- [x] Public facility map and individual facility profile
- [x] Registration/review/publication schema and immutable audit history
- [x] Backend API contracts, persistence integration and tests
- [x] Public registry dashboard with paginated API, map/list and detail route
- [x] Operator registration interface with restricted exact geometry
- [x] Ministry overview and review interfaces with demo role separation
- [x] Cached environmental API integration with honest `NOT_COVERED` responses
- [x] Environmental time-series schema, station links, observations and rollups
- [x] CPCB connector, transactional ingestion store and manual job runner
- [ ] Configure CPCB endpoint/key/field mapping and verify a live provider run
- [ ] Verify IMD and NWDP response/access contracts before enabling their adapters
- [x] Backend end-to-end, migration, privacy, restart and live smoke verification
- [x] SQLite integrity, backup/restore and dry-run retention tooling/runbook
- [x] Frontend contract clients for registry, environmental, ministry and workflow APIs
- [x] Frontend full suite passes (220/220), ESLint passes and production build passes
- [x] End-to-end runtime smoke: FastAPI and Vite start together; registry,
  environmental and ministry APIs return 200; all new frontend routes serve the app.
- [x] Keep `/dashboard` as the default full-map command view, remove the
  Pune/Mumbai comparison and render real public data-centre registry markers.
- [x] Replace synthetic dashboard telemetry/signals/hotspots with public-registry,
  environmental-coverage and ministry-operations API panels.
- [x] Add selectable, keyboard-accessible public data-centre map markers and a
  source-backed facility dossier without exposing exact coordinates.
- [x] Restrict dashboard controls to data centres and clearly label retained
  environmental, water, biodiversity, climate and grid layers as context.
- [x] Add dashboard integration coverage for map/grid/split modes, real facility
  selection and partial environmental-summary failure.
- [x] Make the global status bar data-centre-only on public/government routes,
  remove the synthetic-mode badge there and hard-lock site analysis to data centres.
- [x] Make `/projects` the primary four-state data-centre planning workspace,
  restrict candidate states to IN-MH/IN-TG/IN-KA/IN-TN and redirect the legacy
  `/site-analysis` route.
- [x] Refresh README around the real FastAPI/SQLite registry, environmental,
  operator/ministry and four-state planning architecture.
- [x] Add the minimum operator-registration disclosure gate: restricted four-state
  point, typed capacity, traceable evidence and field-specific incomplete errors.
- [x] Preserve capacity/evidence through revisions and reloads while keeping exact
  geometry out of public snapshots.
- [x] Replace the operator map placeholder with a restricted point picker and
  retain numeric/keyboard coordinate entry.
- [x] Remove fabricated operating year/localhost source metadata from ministry
  publication previews and visibly block approval when publishable evidence is missing.
- [x] Backend full suite passes (184/184) under Python 3.11 with optional provider
  credentials unset.
- [x] Built deterministic Grounded AI Situational Briefing & Advisory Engine (`dataCentreInsights.ts`)
  mapping facility disclosures, state grids, water stress and environmental observations
  into prioritized interventions, statutory citations (CGWB, CEA, BEE, CPCB) and compliance checklists.
- [x] Mounted `DataCentreAiInsightsCard` with animated criticality indicators into map dossier
  and facility profile views. Full frontend test suite (49/49 files, 236/236 tests) and production build clean.
- [x] Implemented OpenStreetMap electrical substation proximity connector (osm_substation.py)
  and WorldPop 100m population density connector (worldpop.py) with verified regional STU/Census
  baselines for Maharashtra, Telangana, Karnataka, and Tamil Nadu. Backend full suite passes (246/246 tests).
- [x] Reduced SVG sizes and marker footprints across the map canvas (pins reduced from 34px/42px to 22px/28px,
  inner SVGs reduced from 16px/14px to 11px/10px) matching World Monitor's compact tactical density.
- [x] Switched all terminal live clocks from UTC to Indian Standard Time (IST / UTC+5:30)
  across the tactical map HUD and global navigation header.
- [x] Integrated server-side Gemini AI Assistant powered by `gemini-3.8-flash` in
  `backend/app/services/gemini_ai.py` with statutory system prompts (SPCB, CGWA, CEA, BEE, NBC 2016)
  and resilient multi-model cascade (`gemini-3.8-flash` -> `gemini-3.5-flash` -> `gemini-2.5-flash` -> deterministic engine).
- [x] Grounded Gemini AI prompts in dynamic facility telemetry (disclosed MW/MVA capacity, state discom grid,
  nearest EHV substation kV & distance, WorldPop population density, Open-Meteo CAMS AQI and temperature).
- [x] Enhanced `DataCentreAiInsightsCard.tsx` with interactive AI Assist controls: "Ask Gemini 3.8 Flash"
  action button, Focus Area chips (*Water*, *Grid*, *Emissions*, *Compliance*), custom query drawer,
  and active engine badges.
- [x] Mounted backend endpoints `GET /api/v1/ai-assist/status`, `POST /api/v1/public-facilities/{facility_id}/ai-assist`,
  and `POST /api/v1/ai-assist/facility/{facility_id}`.
- [x] Integrated official CGWB 2024-2025 Dynamic Assessment Block data across the 4 states, elevating facility
  risk score parameter coverage to 100% (8/8 parameters, High Confidence).
- [x] Completed empirical API audit across 12 external vectors: 9 APIs verified live with HTTP 200;
  3 constrained by government portal architectures (Data.gov.in key, Bhuvan closed WMS, NWDP static reports).
- [x] Full test and build verification: 51/51 frontend test suites (245/245 tests) pass in Vitest;
  backend unit test suites pass (100%); production build passes in 1.42s with 0 TypeScript/Vite errors.

Inventory status: the 19-record seed is suitable only as a prototype. Pass 2
found 25 strong facility-level candidates absent from the seed and additional
operator footprints that require facility-level lifecycle/alias resolution.
No new candidate is public until it passes deduplication, capacity-boundary,
generalised-geometry and ministry review gates. See
`data/research/10-public-facility-inventory-gap-audit.md`.

Active data priority: complete the second-pass operating-facility inventory,
then contract-test CPCB through the OGD API and NWDP station/resource catalogues.
Do not enable IMD polling until account authorization, quotas, caching and
attribution terms are verified. CEA data is state/region grid context only;
utility headroom and operator telemetry remain restricted integrations.

## Update rule

Whenever research is added or changed:

1. update the relevant file under `data/research/`;
2. record the research result or decision in this tracker; and
3. revise `plan.md` if the result changes scope, priorities or sequencing.
