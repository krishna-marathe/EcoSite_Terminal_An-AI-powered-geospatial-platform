# Pune and Mumbai Pilot Implementation Plan

**Goal:** Complete a city-scoped planning workflow with explicit demo/API modes, consistent assessments, saved candidates/scenarios, and reproducible reports.

**Architecture:** Existing React/FastAPI application; a shared JSON contract defines illustrative city extents, synthetic fixtures, and sector scoring weights. API mode never silently falls back to fixtures. Browser-local projects persist candidates and scenarios; the UI and README state the storage scope. Operational multi-user project hosting remains outside this pilot.

**Tech stack:** React, TypeScript, Zustand, TanStack Query, MapLibre, FastAPI, SQLite; Python unittest and Node behavioral checks.

## Shared contracts — manager
- [x] Create `shared/pilot.json`: `cities`, `facilities`, `sectorWeights`, `scoringVersion`.
- [x] Add `CityId = 'pune' | 'mumbai'`, `DataMode = 'demo' | 'api'`; nullable site measurements and insufficient-data status in `frontend/src/types/index.ts`.
- [x] Add `frontend/src/data/pilotCities.ts` with city lookup and extent membership.
- [ ] Implement `getFacilities({cityId}, mode)` using paginated API records or explicit pilot fixtures; validate returned city membership.

## Backend — backend builder
Files: `backend/app/main.py`, additional backend modules, `backend/tests/`, `backend/.env.example`.
- [ ] Load shared city/scoring contract; seed pilot records without deleting existing records.
- [ ] `GET /api/v1/cities`; `GET /api/v1/facilities?city=pune|mumbai&page=1&page_size=100`; canonical city classification uses configured bounds.
- [ ] Protect ingestion with `X-Ingestion-Key` / `ECOSITE_INGESTION_KEY`; validate the whole batch before an atomic write.
- [ ] `POST /site-assessments` accepts required `cityId`; reject points outside city bounds, measure substations only, return null unavailable environmental values and `suitabilityStatus: 'Insufficient data'`.
- [ ] Forecasts support pilot city identifiers, five named metrics, and calendar-month horizons. Synthetic output retains appropriate units and no claim of calibrated confidence intervals.
- [ ] Align risk calculations with shared sector weights and scoring version.
- [ ] Add isolated SQLite regression checks for auth, filtering, proximity, missing values, dates, and scoring.
Run: `python3 -m unittest discover -s backend/tests -v` (all pass).

## Shared frontend and dashboard — frontend builder
Files: `stores/dashboardStore.ts`, `components/`, `pages/Dashboard.tsx`, `app/providers.tsx` and new shared-data hook/components. Excludes `utils/csvExport.ts`, analytical pages, services, and shared types.
- [ ] Store exposes `cityId`, `setCityId`, `dataMode`, `setDataMode`, `facilities`, `setFacilities`, `facilitiesStatus`, `facilitiesError`; selection resolves active dataset. Persist `candidateSites` and per-city scenarios using Zustand persistence.
- [ ] Shared facility loader consumes `getFacilities({cityId}, dataMode)` and protects against stale city/mode responses.
- [ ] Global planning bar selects city/mode and shows loading/error/empty/provenance states and the illustrative extent label.
- [ ] Map, hotspots, telemetry, details, signals, and status consistently consume active city records; no hardcoded national aggregates or observed claims for fixtures.
- [ ] Show Pune/Mumbai comparison with identical normalized indicator definitions and coverage, without claiming city-wide measured statistics.
- [ ] Make metrics legible inside narrow panels; provide visible map failure state and fix policy-news lint issue.

## Analytical workflow — analytics builder
Files: `pages/SiteAnalysis.tsx`, `Forecast.tsx`, `RiskAnalysis.tsx`, `Mitigation.tsx`; corresponding service files, analytical tests. Excludes shared types and store.
- [ ] Use active city/mode and shared facilities throughout; handle empty data explicitly.
- [ ] City-specific candidate presets and validation, nullable measurements, explicit insufficient-data suitability, persistent city-scoped comparison.
- [ ] Demo forecasts generated with correct periods/units; unsupported pairs unavailable; API errors visible. No stale city response overwrites.
- [ ] Sector weights import shared contract; risk explanations preserve actual provenance and normalized units.
- [ ] Catalog and AI recommendations honestly labeled; validate structured AI output, surface errors, remove fabricated savings/AI claims.

## Reports, documentation and integration — manager
Files: `pages/Reports.tsx`, `utils/csvExport.ts`, `README.md`, existing setup documentation (preserve prior user changes), focused tests and validation scripts.
- [ ] Reports use active city facilities, candidates, scenario, source statuses and scoring version; export JSON planning dossier and CSV, print view, null-safe and formula-safe exports.
- [ ] Document setup, city extents, ingestion, synthetic source limitations, browser-local persistence, and supported demo/API behavior. Preserve existing Windows virtualenv setup work.
- [ ] Measure generated data ingestion/filter query timings using a disposable database; publish exact workload/results, not an unmeasured scalability claim.
- [ ] Run `node frontend/node_modules/typescript/bin/tsc -b frontend`, `node frontend/node_modules/eslint/bin/eslint.js frontend`, `node frontend/node_modules/vite/bin/vite.js build frontend`.
- [ ] Browser proof: switch Pune/Mumbai; compare coverage; evaluate/save candidate; apply scenario; reload; export city dossier. Repeat API mode with isolated backend and verify request failure stays visible.
- [ ] Run `graphify update .` per inherited repository instructions if the command is available; report inability if absent.

Stop when the implemented pilot workflow and regression checks pass. Real municipal observations and validated predictive models require supplied or verified datasets; this build explicitly supports synthetic demonstrations and normalized facility ingestion without inventing that evidence.
